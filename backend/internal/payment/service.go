package payment

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment/provider"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/pix"
)

type Service struct {
	repo         Repository
	leaseReader  LeaseReader
	tenantReader TenantReader
	unitReader   UnitReader
	ownerReader  OwnerReader
	irrf         IRRFCalculator
	events       EventStore
	loc          *time.Location
	now          func() time.Time
}

func NewService(repo Repository, lr LeaseReader, tr TenantReader, ur UnitReader, ow OwnerReader, irrf IRRFCalculator) *Service {
	return &Service{repo: repo, leaseReader: lr, tenantReader: tr, unitReader: ur, ownerReader: ow, irrf: irrf, loc: time.UTC, now: time.Now}
}

// WithEvents habilita a linha do tempo e o registro de envio da cobrança.
func (s *Service) WithEvents(e EventStore) *Service {
	s.events = e
	return s
}

// WithLocation define o fuso usado para decidir o que é "hoje" (vencida ou a vencer).
func (s *Service) WithLocation(loc *time.Location) *Service {
	s.loc = loc
	return s
}

// WithClock troca o relógio (testes).
func (s *Service) WithClock(now func() time.Time) *Service {
	s.now = now
	return s
}

func (s *Service) today() time.Time {
	y, m, d := s.now().In(s.loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func (s *Service) Create(ctx context.Context, userID, orgID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	if in.LeaseID == uuid.Nil {
		return nil, fmt.Errorf("payment.svc: lease_id obrigatório")
	}
	if in.GrossAmount <= 0 {
		return nil, fmt.Errorf("payment.svc: gross_amount > 0")
	}
	valid := map[string]bool{"RENT": true, "DEPOSIT": true, "EXPENSE": true, "OTHER": true}
	if !valid[in.Type] {
		return nil, fmt.Errorf("payment.svc: type inválido")
	}
	return s.repo.Create(ctx, userID, orgID, in)
}

func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Payment, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	enriched := s.Enrich(ctx, *p)
	return &enriched, nil
}

func (s *Service) ListByLease(ctx context.Context, leaseID, orgID uuid.UUID) ([]Payment, error) {
	list, err := s.repo.ListByLease(ctx, leaseID, orgID)
	if err != nil {
		return nil, err
	}
	leases := map[uuid.UUID]*lease.Lease{}
	for i, p := range list {
		list[i] = s.enrich(ctx, p, leases)
	}
	return list, nil
}

func validStatusFilter(status string) bool {
	switch status {
	case "", "PENDING", "LATE", "PAID":
		return true
	}
	return false
}

// List devolve as cobranças da organização filtradas em SQL, já com LATE, multa e juros calculados.
func (s *Service) List(ctx context.Context, orgID uuid.UUID, f PaymentFilter) ([]Payment, error) {
	if !validStatusFilter(f.Status) {
		return nil, ErrInvalidFilter
	}
	list, err := s.repo.List(ctx, orgID, f, s.today())
	if err != nil {
		return nil, err
	}
	leases := map[uuid.UUID]*lease.Lease{}
	for i, p := range list {
		list[i] = s.enrich(ctx, p, leases)
	}
	return list, nil
}

// ListByOwner lista as cobranças da organização, opcionalmente só de um status.
func (s *Service) ListByOwner(ctx context.Context, orgID uuid.UUID, statusFilter string) ([]Payment, error) {
	return s.List(ctx, orgID, PaymentFilter{Status: statusFilter})
}

// Summary totaliza o período por vencimento. "Vencidos" soma o valor atualizado (bruto + multa + juros);
// "recebidos" soma o líquido quando existe, senão o bruto. Filtro de status não se aplica.
func (s *Service) Summary(ctx context.Context, orgID uuid.UUID, f PaymentFilter) (Summary, error) {
	f.Status = ""
	list, err := s.List(ctx, orgID, f)
	if err != nil {
		return Summary{}, err
	}
	var sum Summary
	add := func(b *Bucket, v float64) {
		b.Count++
		b.Total = round2(b.Total + v)
	}
	for _, p := range list {
		switch {
		case p.Status == "PAID":
			if p.NetAmount != nil {
				add(&sum.Paid, *p.NetAmount)
			} else {
				add(&sum.Paid, p.GrossAmount)
			}
		case p.Status == "LATE":
			add(&sum.Overdue, p.GrossAmount+p.LateFeeAmount+p.InterestAmount)
		default:
			add(&sum.ToReceive, p.GrossAmount)
		}
	}
	return sum, nil
}

// Enrich calcula LATE, multa e juros de uma cobrança não paga e vencida.
func (s *Service) Enrich(ctx context.Context, p Payment) Payment {
	return s.enrich(ctx, p, map[uuid.UUID]*lease.Lease{})
}

// enrich reaproveita leases já lidos (cache por chamada) para não consultar o mesmo contrato N vezes.
func (s *Service) enrich(ctx context.Context, p Payment, leases map[uuid.UUID]*lease.Lease) Payment {
	if p.PaidDate != nil || p.Status == "PAID" {
		return p
	}
	now := s.now()
	if !now.After(p.DueDate) {
		return p
	}
	daysLate := int(now.Sub(p.DueDate).Hours() / 24)
	if daysLate <= 0 {
		return p
	}
	l, ok := leases[p.LeaseID]
	if !ok {
		var err error
		l, err = s.leaseReader.GetByID(ctx, p.LeaseID, p.OrganizationID)
		if err != nil {
			return p
		}
		leases[p.LeaseID] = l
	}
	// late_fee_percent e daily_interest_percent são percentuais (2 = 2%), como validam os inputs do contrato.
	p.LateFeeAmount = round2(p.GrossAmount * l.LateFeePercent / 100)
	p.InterestAmount = round2(p.GrossAmount * l.DailyInterestPercent / 100 * float64(daysLate))
	p.Status = "LATE"
	return p
}

func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	return s.UpdateBy(ctx, id, orgID, uuid.Nil, in)
}

// UpdateBy é Update com o autor da mudança, usado no evento de pagamento.
func (s *Service) UpdateBy(ctx context.Context, id, orgID, actorID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	validStatuses := map[string]bool{"PENDING": true, "PAID": true, "LATE": true}
	if !validStatuses[in.Status] {
		return nil, fmt.Errorf("payment.svc: status inválido")
	}
	if in.PaidDate != nil && in.Status == "PAID" {
		return s.markPaid(ctx, id, orgID, actorID, *in.PaidDate, in)
	}
	return s.repo.Update(ctx, id, orgID, in)
}

// ErrInvalidDiscount: desconto negativo ou maior que o valor devido (HTTP 400).
var ErrInvalidDiscount = errors.New("payment: desconto inválido")

var errAlreadyPaid = errors.New("payment already paid")
var errNotPaid = errors.New("payment not paid")

func (s *Service) markPaid(ctx context.Context, id, orgID, actorID uuid.UUID, paidDate time.Time, in UpdatePaymentInput) (*Payment, error) {
	current, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", err)
	}
	if current.Status == "PAID" {
		return nil, errAlreadyPaid
	}

	l, err := s.leaseReader.GetByID(ctx, current.LeaseID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load lease: %w", err)
	}

	var lateFee, interest float64
	if paidDate.After(current.DueDate) {
		daysLate := int(paidDate.Sub(current.DueDate).Hours() / 24)
		if daysLate > 0 {
			lateFee = round2(current.GrossAmount * l.LateFeePercent / 100)
			interest = round2(current.GrossAmount * l.DailyInterestPercent / 100 * float64(daysLate))
		}
	}

	// O desconto abate do que o inquilino de fato paga; o IRRF incide sobre esse valor.
	due := current.GrossAmount + lateFee + interest
	discount := round2(in.DiscountAmount)
	if discount < 0 || discount > round2(due) {
		return nil, fmt.Errorf("payment.svc: %w", ErrInvalidDiscount)
	}

	var irrf float64
	if current.Type == "RENT" {
		tn, err := s.tenantReader.GetByID(ctx, l.TenantID, orgID)
		if err != nil {
			return nil, fmt.Errorf("payment.svc: load tenant: %w", err)
		}
		if tn.PersonType == "PJ" {
			base := due - discount
			v, err := s.irrf.Calculate(ctx, base, paidDate)
			if err != nil {
				return nil, fmt.Errorf("payment.svc: irrf: %w", err)
			}
			irrf = v
		}
	}

	net := round2(due - discount - irrf)
	var actor *uuid.UUID
	if actorID != uuid.Nil {
		actor = &actorID
	}
	return s.repo.MarkPaid(ctx, id, orgID, PaidInput{
		PaidDate: paidDate, LateFee: lateFee, Interest: interest, IRRF: irrf, Net: net,
		Discount: discount, Method: in.PaymentMethod, Note: in.PaymentNote, ActorID: actor,
	})
}

func (s *Service) IsAlreadyPaid(err error) bool {
	return errors.Is(err, errAlreadyPaid)
}

func (s *Service) IsNotPaid(err error) bool {
	return errors.Is(err, errNotPaid)
}

func (s *Service) getProvider(fc *FinancialConfig) (provider.PaymentProvider, error) {
	if fc == nil {
		return nil, errors.New("financial config is missing")
	}

	// Convert map[string]any to map[string]string for provider config
	stringConfig := make(map[string]string)
	for k, v := range fc.Config {
		if strVal, ok := v.(string); ok {
			stringConfig[k] = strVal
		} else {
			stringConfig[k] = fmt.Sprintf("%v", v)
		}
	}

	return provider.NewProvider(fc.Provider, stringConfig)
}

// CancelFuturePending retira as cobranças pendentes futuras de um contrato encerrado.
// Cobranças já emitidas no provedor (charge_id) são mantidas e contadas em NeedsReview.
func (s *Service) CancelFuturePending(ctx context.Context, leaseID, orgID uuid.UUID, after time.Time) (DeactivateResult, error) {
	res, err := s.repo.DeactivateFuturePending(ctx, leaseID, orgID, after)
	if err != nil {
		return res, fmt.Errorf("payment.svc: cancelar futuras pendentes: %w", err)
	}
	return res, nil
}

// ReadjustFuturePending aplica o aluguel reajustado às cobranças de aluguel futuras pendentes do contrato.
// Cobranças já emitidas no provedor (charge_id) são mantidas e contadas em NeedsReview.
func (s *Service) ReadjustFuturePending(ctx context.Context, leaseID, orgID uuid.UUID, from time.Time, amount float64) (RentUpdateResult, error) {
	if amount <= 0 {
		return RentUpdateResult{}, fmt.Errorf("payment.svc: valor do aluguel deve ser positivo")
	}
	res, err := s.repo.UpdateFuturePendingRent(ctx, leaseID, orgID, from, amount)
	if err != nil {
		return res, fmt.Errorf("payment.svc: reajustar futuras pendentes: %w", err)
	}
	return res, nil
}

func (s *Service) GenerateMonth(ctx context.Context, userID, leaseID, orgID uuid.UUID, month string) ([]Payment, error) {
	monthStart, err := time.Parse("2006-01", month)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", ErrInvalidMonth)
	}

	l, err := s.leaseReader.GetByID(ctx, leaseID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", err)
	}
	if l.Status != "ACTIVE" {
		return nil, fmt.Errorf("payment.svc: %w", ErrLeaseNotActive)
	}

	leaseStart := time.Date(l.StartDate.Year(), l.StartDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	if monthStart.Before(leaseStart) {
		return nil, fmt.Errorf("payment.svc: mês antes do lease.start_date")
	}
	if l.EndDate != nil {
		leaseEnd := time.Date(l.EndDate.Year(), l.EndDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		if monthStart.After(leaseEnd) {
			return nil, fmt.Errorf("payment.svc: mês após lease.end_date")
		}
	}

	dueDay := l.PaymentDay
	if dueDay < 1 {
		dueDay = l.StartDate.Day()
	}
	dueDate := dueDateForMonth(dueDay, monthStart)

	results := make([]Payment, 0, 2)

	rentInput := CreatePaymentInput{
		LeaseID: leaseID, DueDate: dueDate, GrossAmount: l.RentAmount,
		Type: "RENT", Competency: &month,
	}
	p, _, err := s.repo.CreateIfAbsent(ctx, userID, orgID, rentInput)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: generate rent: %w", err)
	}
	results = append(results, *p)

	if l.IPTUReimbursable {
		if l.AnnualIPTUAmount == nil {
			return nil, fmt.Errorf("payment.svc: %w", ErrIPTUMissing)
		}
		parcelaValor := round2(*l.AnnualIPTUAmount / 12)
		year := l.IPTUYear
		if year == nil {
			y := monthStart.Year()
			year = &y
		}
		desc := fmt.Sprintf("IPTU %d - parcela %s/12", *year, monthStart.Format("01"))
		iptuInput := CreatePaymentInput{
			LeaseID: leaseID, DueDate: dueDate, GrossAmount: parcelaValor,
			Type: "EXPENSE", Competency: &month, Description: &desc,
		}
		p2, _, err := s.repo.CreateIfAbsent(ctx, userID, orgID, iptuInput)
		if err != nil {
			return nil, fmt.Errorf("payment.svc: generate iptu: %w", err)
		}
		results = append(results, *p2)
	}
	return results, nil
}

// dueDateForMonth devolve o vencimento no dia dueDay do mês, ajustado ao último dia quando o mês é menor.
func dueDateForMonth(dueDay int, monthStart time.Time) time.Time {
	y, m, _ := monthStart.Date()
	lastDayOfMonth := time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
	day := dueDay
	if day > lastDayOfMonth {
		day = lastDayOfMonth
	}
	return time.Date(y, m, day, 0, 0, 0, 0, time.UTC)
}

// BuildReceipt monta o recibo de uma cobrança paga. orgID escopa os dados; userID é o usuário
// autenticado, exibido como locador (o ownerReader busca usuários, não organizações).
func (s *Service) BuildReceipt(ctx context.Context, id, orgID, userID uuid.UUID) (*Receipt, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", err)
	}
	if p.Status != "PAID" || p.PaidDate == nil {
		return nil, errNotPaid
	}
	// Cobranças pagas antes da numeração recebem o número na primeira emissão.
	if p.ReceiptNumber == nil {
		if p, err = s.repo.EnsureReceiptNumber(ctx, id, orgID); err != nil {
			return nil, fmt.Errorf("payment.svc: %w", err)
		}
	}
	l, err := s.leaseReader.GetByID(ctx, p.LeaseID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load lease: %w", err)
	}
	tn, err := s.tenantReader.GetByID(ctx, l.TenantID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load tenant: %w", err)
	}
	ow, err := s.ownerReader.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load owner: %w", err)
	}
	un, err := s.unitReader.GetByID(ctx, l.UnitID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load unit: %w", err)
	}

	pt := tn.PersonType
	net := 0.0
	if p.NetAmount != nil {
		net = *p.NetAmount
	}

	number := ""
	if p.ReceiptNumber != nil && p.ReceiptYear != nil {
		number = fmt.Sprintf("%04d/%d", *p.ReceiptNumber, *p.ReceiptYear)
	}

	return &Receipt{
		PaymentID:     p.ID,
		Number:        number,
		PaymentMethod: p.PaymentMethod,
		Note:          p.PaymentNote,
		Competency:    p.Competency,
		IssuedAt:      time.Now(),
		Owner:         Party{Name: ow.Name, Document: ow.Document},
		Tenant:        Party{Name: tn.Name, Document: tn.Document, PersonType: &pt},
		Unit:          UnitRef{Label: un.Label, PropertyAddress: un.PropertyAddress},
		Amounts: Amounts{
			Gross:        p.GrossAmount,
			LateFee:      p.LateFeeAmount,
			Interest:     p.InterestAmount,
			Discount:     p.DiscountAmount,
			IRRFWithheld: p.IRRFAmount,
			NetPaid:      net,
		},
		PaidDate:  *p.PaidDate,
		LegalNote: "Recibo emitido conforme Lei 8.245/91, art. 22, IV.",
	}, nil
}

func round2(x float64) float64 {
	return math.Round(x*100) / 100
}

var (
	errNoFinancialConfig = fmt.Errorf("no financial config found")
	errNoChargeCreated   = fmt.Errorf("no charge created")
	errPaymentNotPaid    = fmt.Errorf("payment not paid")
	errInvalidMethod     = fmt.Errorf("invalid method")
)

func (s *Service) CreateCharge(ctx context.Context, paymentID, orgID uuid.UUID, method string) (*provider.ChargeResponse, error) {
	payment, err := s.repo.GetByID(ctx, paymentID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: get payment: %w", err)
	}

	if payment.Status == "PAID" {
		return nil, fmt.Errorf("payment already paid")
	}

	l, err := s.leaseReader.GetByID(ctx, payment.LeaseID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load lease: %w", err)
	}

	tn, err := s.tenantReader.GetByID(ctx, l.TenantID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load tenant: %w", err)
	}

	customer := provider.Customer{
		Name:     tn.Name,
		Document: "",
		Email:    "",
	}
	if tn.Email != nil {
		customer.Email = *tn.Email
	}
	if tn.Document != nil {
		customer.Document = *tn.Document
	}

	fc, err := s.getActiveFinancialConfig(ctx, orgID)
	if err != nil {
		return nil, errNoFinancialConfig
	}

	prov, err := s.getProvider(fc)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: new provider: %w", err)
	}

	req := provider.ChargeRequest{
		Amount:      payment.GrossAmount,
		Currency:    "BRL",
		DueDate:     &payment.DueDate,
		Customer:    customer,
		Reference:   paymentID.String(),
		Description: fmt.Sprintf("Pagamento %s", payment.Type),
	}

	var resp *provider.ChargeResponse

	if method == "PIX" {
		resp, err = prov.CreatePIXCharge(ctx, req)
	} else if method == "BOLETO" {
		resp, err = prov.CreateBoletoCharge(ctx, req)
	} else {
		return nil, errInvalidMethod
	}

	if err != nil {
		return nil, fmt.Errorf("payment.svc: create charge: %w", err)
	}

	err = s.repo.UpdateChargeInfo(ctx, paymentID, orgID, UpdateChargeInfoInput{
		ChargeID:     resp.ChargeID,
		ChargeMethod: method,
		QRCode:       resp.QRCode,
		Link:         resp.QRLink,
		BarCode:      resp.BarCode,
	})

	if err != nil {
		return nil, fmt.Errorf("payment.svc: update charge info: %w", err)
	}

	return resp, nil
}

func (s *Service) GetChargeStatus(ctx context.Context, paymentID, orgID uuid.UUID) (*provider.ChargeStatus, error) {
	payment, err := s.repo.GetByID(ctx, paymentID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: get payment: %w", err)
	}

	if payment.ChargeID == nil || *payment.ChargeID == "" {
		return nil, errNoChargeCreated
	}

	fc, err := s.getActiveFinancialConfig(ctx, orgID)
	if err != nil {
		return nil, errNoFinancialConfig
	}

	prov, err := s.getProvider(fc)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: new provider: %w", err)
	}

	return prov.GetChargeStatus(ctx, *payment.ChargeID)
}

func (s *Service) CreatePayout(ctx context.Context, paymentID, orgID uuid.UUID, dest provider.Destination) (*provider.PayoutResponse, error) {
	payment, err := s.repo.GetByID(ctx, paymentID, orgID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: get payment: %w", err)
	}

	if payment.Status != "PAID" {
		return nil, errPaymentNotPaid
	}

	if payment.NetAmount == nil {
		return nil, fmt.Errorf("payment net amount is nil")
	}

	fc, err := s.getActiveFinancialConfig(ctx, orgID)
	if err != nil {
		return nil, errNoFinancialConfig
	}

	prov, err := s.getProvider(fc)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: new provider: %w", err)
	}

	req := provider.PayoutRequest{
		Amount:      *payment.NetAmount,
		Currency:    "BRL",
		Destination: dest,
		Reference:   paymentID.String(),
	}

	resp, err := prov.CreatePayout(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: create payout: %w", err)
	}

	err = s.repo.UpdatePayoutInfo(ctx, paymentID, orgID, resp.PayoutID, resp.Status)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: update payout info: %w", err)
	}

	return resp, nil
}

func (s *Service) ProcessWebhook(ctx context.Context, providerName string, event map[string]interface{}) error {
	eventType, ok := event["event"].(string)
	if !ok {
		return fmt.Errorf("invalid webhook event")
	}

	if eventType != "PAYMENT_RECEIVED" {
		return nil
	}

	chargeID, ok := event["chargeId"].(string)
	if !ok {
		return fmt.Errorf("invalid charge id")
	}

	payment, err := s.repo.GetByChargeID(ctx, chargeID)
	if err != nil {
		return fmt.Errorf("payment not found for charge: %s", chargeID)
	}

	if payment.Status == "PAID" {
		return nil // idempotent - already paid
	}

	now := time.Now()
	_, err = s.repo.Update(ctx, payment.ID, payment.OrganizationID, UpdatePaymentInput{
		Status:   "PAID",
		PaidDate: &now,
	})
	if err != nil {
		return fmt.Errorf("payment.svc: update payment: %w", err)
	}

	return nil
}

func (s *Service) GetFinancialConfig(ctx context.Context, orgID uuid.UUID) (*FinancialConfig, error) {
	return s.repo.GetFinancialConfig(ctx, orgID)
}

func (s *Service) UpdateFinancialConfig(ctx context.Context, orgID uuid.UUID, in UpsertFinancialConfigInput) (*FinancialConfig, error) {
	// Simple validation, let repo handle strict types
	return s.repo.UpsertFinancialConfig(ctx, orgID, in)
}

func (s *Service) getActiveFinancialConfig(ctx context.Context, orgID uuid.UUID) (*FinancialConfig, error) {
	return s.repo.GetActiveFinancialConfig(ctx, orgID)
}

var _ = lease.Lease{}
var _ = tenant.Tenant{}

// ErrInvalidEvent: tipo ou canal de evento não permitido na API (HTTP 400).
var ErrInvalidEvent = errors.New("payment: evento inválido")

// Timeline devolve a linha do tempo: marco Criada, eventos gravados e, se vencida e não paga, o marco Venceu em.
func (s *Service) Timeline(ctx context.Context, id, orgID uuid.UUID) ([]TimelineItem, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	items := []TimelineItem{{Kind: TimelineCreated, At: p.CreatedAt, Synthetic: true}}
	if s.events != nil {
		evs, err := s.events.ListEvents(ctx, id, orgID)
		if err != nil {
			return nil, fmt.Errorf("payment.svc: eventos: %w", err)
		}
		for _, e := range evs {
			items = append(items, TimelineItem{Kind: e.Kind, At: e.OccurredAt, Channel: e.Channel, Data: e.Data, ActorID: e.ActorID})
		}
	}
	if p.Status != "PAID" && p.DueDate.Before(s.today()) {
		items = append(items, TimelineItem{Kind: TimelineOverdue, At: p.DueDate, Synthetic: true})
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].At.Before(items[j].At) })
	return items, nil
}

// RecordEvent registra o envio (SENT) ou o lembrete (REMINDER) de uma cobrança ainda aberta.
func (s *Service) RecordEvent(ctx context.Context, id, orgID, actorID uuid.UUID, in RecordEventInput) (*Event, error) {
	if (in.Kind != EventSent && in.Kind != EventReminder) ||
		(in.Channel != "WHATSAPP" && in.Channel != "EMAIL" && in.Channel != "COPY") {
		return nil, fmt.Errorf("payment.svc: %w", ErrInvalidEvent)
	}
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if p.Status == "PAID" {
		return nil, errAlreadyPaid
	}
	if s.events == nil {
		return nil, fmt.Errorf("payment.svc: eventos não configurados")
	}
	ch := in.Channel
	var actor *uuid.UUID
	if actorID != uuid.Nil {
		actor = &actorID
	}
	return s.events.AddEvent(ctx, orgID, id, actor, in.Kind, &ch, nil)
}

// ErrPixKeyNotConfigured: a organização não cadastrou a chave Pix (HTTP 422).
var ErrPixKeyNotConfigured = errors.New("payment: chave Pix não configurada")

// PixPayload gera o Pix copia-e-cola da cobrança com o valor atualizado do dia (bruto + multa + juros se atrasada).
func (s *Service) PixPayload(ctx context.Context, id, orgID, userID uuid.UUID) (*PixCode, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if p.Status == "PAID" {
		return nil, errAlreadyPaid
	}
	fc, err := s.repo.GetActiveFinancialConfig(ctx, orgID)
	if err != nil || fc == nil || fc.PixKey == nil || strings.TrimSpace(*fc.PixKey) == "" {
		return nil, ErrPixKeyNotConfigured
	}
	enriched := s.Enrich(ctx, *p)
	amount := round2(enriched.GrossAmount + enriched.LateFeeAmount + enriched.InterestAmount)

	name := ""
	if owner, err := s.ownerReader.GetByID(ctx, userID); err == nil && owner != nil {
		name = owner.Name
	}
	city := ""
	if l, err := s.leaseReader.GetByID(ctx, p.LeaseID, orgID); err == nil {
		if u, err := s.unitReader.GetByID(ctx, l.UnitID, orgID); err == nil && u.PropertyCity != nil {
			city = *u.PropertyCity
		}
	}
	payload, err := pix.Build(pix.Params{Key: *fc.PixKey, Name: name, City: city, Amount: amount, TxID: pix.TxIDFromID(id.String())})
	if err != nil {
		return nil, fmt.Errorf("payment.svc: pix: %w", err)
	}
	return &PixCode{Payload: payload, Amount: amount}, nil
}

// Erros do acordo de atraso.
var (
	// ErrInvalidAgreementDate: a nova data não é posterior a hoje (HTTP 400).
	ErrInvalidAgreementDate = errors.New("payment: nova data do acordo deve ser posterior a hoje")
	// ErrInvalidAgreement: valor combinado inválido (HTTP 400).
	ErrInvalidAgreement = errors.New("payment: acordo inválido")
	// ErrPaymentHasCharge: cobrança emitida pelo provedor não aceita acordo (HTTP 409).
	ErrPaymentHasCharge = errors.New("payment: cobrança já emitida pelo provedor")
)

// Agree registra um acordo de atraso: novo vencimento e valor combinado. O valor padrão é o total atualizado de hoje
// (bruto, multa e juros). Se a nova data passar sem pagamento, a cobrança volta a atrasar a partir dela.
func (s *Service) Agree(ctx context.Context, id, orgID, actorID uuid.UUID, in AgreementInput) (*Payment, error) {
	p, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if p.Status == "PAID" {
		return nil, errAlreadyPaid
	}
	if p.ChargeID != nil && *p.ChargeID != "" {
		return nil, ErrPaymentHasCharge
	}
	y, m, d := in.NewDueDate.Date()
	newDue := time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
	if !newDue.After(s.today()) {
		return nil, fmt.Errorf("payment.svc: %w", ErrInvalidAgreementDate)
	}
	amount := 0.0
	if in.AgreedAmount != nil {
		if *in.AgreedAmount <= 0 {
			return nil, fmt.Errorf("payment.svc: %w", ErrInvalidAgreement)
		}
		amount = round2(*in.AgreedAmount)
	} else {
		e := s.Enrich(ctx, *p)
		amount = round2(e.GrossAmount + e.LateFeeAmount + e.InterestAmount)
	}
	var actor *uuid.UUID
	if actorID != uuid.Nil {
		actor = &actorID
	}
	out, err := s.repo.ApplyAgreement(ctx, id, orgID, AgreementApply{
		NewDueDate: newDue, NewGross: amount, OldDueDate: p.DueDate, OldGross: p.GrossAmount, Note: in.Note, ActorID: actor,
	})
	if err != nil {
		return nil, err
	}
	enriched := s.Enrich(ctx, *out)
	return &enriched, nil
}

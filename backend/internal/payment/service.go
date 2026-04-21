package payment

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/tenant"
)

type Service struct {
	repo         Repository
	leaseReader  LeaseReader
	tenantReader TenantReader
	unitReader   UnitReader
	ownerReader  OwnerReader
	irrf         IRRFCalculator
}

func NewService(repo Repository, lr LeaseReader, tr TenantReader, ur UnitReader, ow OwnerReader, irrf IRRFCalculator) *Service {
	return &Service{repo: repo, leaseReader: lr, tenantReader: tr, unitReader: ur, ownerReader: ow, irrf: irrf}
}

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
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
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) Get(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error) {
	p, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return nil, err
	}
	enriched := s.Enrich(ctx, *p)
	return &enriched, nil
}

func (s *Service) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error) {
	list, err := s.repo.ListByLease(ctx, leaseID, ownerID)
	if err != nil {
		return nil, err
	}
	for i, p := range list {
		list[i] = s.Enrich(ctx, p)
	}
	return list, nil
}

func (s *Service) Enrich(ctx context.Context, p Payment) Payment {
	if p.PaidDate != nil {
		return p
	}
	if !time.Now().After(p.DueDate) {
		return p
	}
	l, err := s.leaseReader.GetByID(ctx, p.LeaseID, p.OwnerID)
	if err != nil {
		return p
	}
	daysLate := int(time.Now().Sub(p.DueDate).Hours() / 24)
	if daysLate <= 0 {
		return p
	}
	p.LateFeeAmount = round2(p.GrossAmount * l.LateFeePercent)
	p.InterestAmount = round2(p.GrossAmount * l.DailyInterestPercent * float64(daysLate))
	p.Status = "LATE"
	return p
}

func (s *Service) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	validStatuses := map[string]bool{"PENDING": true, "PAID": true, "LATE": true}
	if !validStatuses[in.Status] {
		return nil, fmt.Errorf("payment.svc: status inválido")
	}
	if in.PaidDate != nil && in.Status == "PAID" {
		return s.markPaid(ctx, id, ownerID, *in.PaidDate)
	}
	return s.repo.Update(ctx, id, ownerID, in)
}

var errAlreadyPaid = errors.New("payment already paid")
var errNotPaid = errors.New("payment not paid")

func (s *Service) markPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time) (*Payment, error) {
	current, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", err)
	}
	if current.Status == "PAID" {
		return nil, errAlreadyPaid
	}

	l, err := s.leaseReader.GetByID(ctx, current.LeaseID, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load lease: %w", err)
	}

	var lateFee, interest float64
	if paidDate.After(current.DueDate) {
		daysLate := int(paidDate.Sub(current.DueDate).Hours() / 24)
		if daysLate > 0 {
			lateFee = round2(current.GrossAmount * l.LateFeePercent)
			interest = round2(current.GrossAmount * l.DailyInterestPercent * float64(daysLate))
		}
	}

	var irrf float64
	if current.Type == "RENT" {
		tn, err := s.tenantReader.GetByID(ctx, l.TenantID, ownerID)
		if err != nil {
			return nil, fmt.Errorf("payment.svc: load tenant: %w", err)
		}
		if tn.PersonType == "PJ" {
			base := current.GrossAmount + lateFee + interest
			v, err := s.irrf.Calculate(ctx, base, paidDate)
			if err != nil {
				return nil, fmt.Errorf("payment.svc: irrf: %w", err)
			}
			irrf = v
		}
	}

	net := round2(current.GrossAmount + lateFee + interest - irrf)
	return s.repo.MarkPaid(ctx, id, ownerID, paidDate, lateFee, interest, irrf, net)
}

func (s *Service) IsAlreadyPaid(err error) bool {
	return errors.Is(err, errAlreadyPaid)
}

func (s *Service) IsNotPaid(err error) bool {
	return errors.Is(err, errNotPaid)
}

func (s *Service) GenerateMonth(ctx context.Context, leaseID, ownerID uuid.UUID, month string) ([]Payment, error) {
	monthStart, err := time.Parse("2006-01", month)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: month inválido (esperado YYYY-MM)")
	}

	l, err := s.leaseReader.GetByID(ctx, leaseID, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", err)
	}
	if l.Status != "ACTIVE" {
		return nil, fmt.Errorf("payment.svc: lease not active")
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

	dueDate := dueDateForMonth(l.StartDate, monthStart)

	results := make([]Payment, 0, 2)

	rentInput := CreatePaymentInput{
		LeaseID: leaseID, DueDate: dueDate, GrossAmount: l.RentAmount,
		Type: "RENT", Competency: &month,
	}
	p, _, err := s.repo.CreateIfAbsent(ctx, ownerID, rentInput)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: generate rent: %w", err)
	}
	results = append(results, *p)

	if l.IPTUReimbursable {
		if l.AnnualIPTUAmount == nil {
			return nil, fmt.Errorf("payment.svc: iptu_reimbursable=true mas annual_iptu_amount ausente")
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
		p2, _, err := s.repo.CreateIfAbsent(ctx, ownerID, iptuInput)
		if err != nil {
			return nil, fmt.Errorf("payment.svc: generate iptu: %w", err)
		}
		results = append(results, *p2)
	}
	return results, nil
}

func dueDateForMonth(leaseStart time.Time, monthStart time.Time) time.Time {
	y, m, _ := monthStart.Date()
	lastDayOfMonth := time.Date(y, m+1, 0, 0, 0, 0, 0, time.UTC).Day()
	day := leaseStart.Day()
	if day > lastDayOfMonth {
		day = lastDayOfMonth
	}
	return time.Date(y, m, day, 0, 0, 0, 0, time.UTC)
}

func (s *Service) BuildReceipt(ctx context.Context, id, ownerID uuid.UUID) (*Receipt, error) {
	p, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: %w", err)
	}
	if p.Status != "PAID" || p.PaidDate == nil {
		return nil, errNotPaid
	}
	l, err := s.leaseReader.GetByID(ctx, p.LeaseID, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load lease: %w", err)
	}
	tn, err := s.tenantReader.GetByID(ctx, l.TenantID, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load tenant: %w", err)
	}
	ow, err := s.ownerReader.GetByID(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load owner: %w", err)
	}
	un, err := s.unitReader.GetByID(ctx, l.UnitID, ownerID)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: load unit: %w", err)
	}

	pt := tn.PersonType
	net := 0.0
	if p.NetAmount != nil {
		net = *p.NetAmount
	}

	return &Receipt{
		PaymentID:  p.ID,
		Competency: p.Competency,
		IssuedAt:   time.Now(),
		Owner:      Party{Name: ow.Name, Document: ow.Document},
		Tenant:     Party{Name: tn.Name, Document: tn.Document, PersonType: &pt},
		Unit:       UnitRef{Label: un.Label, PropertyAddress: un.PropertyAddress},
		Amounts: Amounts{
			Gross:        p.GrossAmount,
			LateFee:      p.LateFeeAmount,
			Interest:     p.InterestAmount,
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

var _ = lease.Lease{}
var _ = tenant.Tenant{}

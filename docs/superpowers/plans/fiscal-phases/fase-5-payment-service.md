## Fase 5 — Payment service: Enrich, GenerateMonth, MarkPaid

### Task 17: Payment service — Enrich (multa/juros on-read)

**Files:**
- Modify: `backend/internal/payment/service.go`
- Modify: `backend/internal/payment/service_test.go`

- [ ] **Step 1: Escrever teste**

No `service_test.go`, add mocks mínimos para as novas deps:

```go
type mockLeaseReader struct {
	leases map[uuid.UUID]*lease.Lease
}

func (m *mockLeaseReader) GetByID(_ context.Context, id, ownerID uuid.UUID) (*lease.Lease, error) {
	l, ok := m.leases[id]
	if !ok || l.OwnerID != ownerID { return nil, errors.New("not found") }
	return l, nil
}

type mockTenantReader struct {
	tenants map[uuid.UUID]*tenant.Tenant
}

func (m *mockTenantReader) GetByID(_ context.Context, id, ownerID uuid.UUID) (*tenant.Tenant, error) {
	t, ok := m.tenants[id]
	if !ok || t.OwnerID != ownerID { return nil, errors.New("not found") }
	return t, nil
}

type mockIRRFTable struct{ fixed float64 }

func (m *mockIRRFTable) Calculate(_ context.Context, base float64, _ time.Time) (float64, error) {
	return m.fixed, nil
}
```

Testes do `Enrich`:
```go
func TestService_Enrich_NãoAtrasado(t *testing.T) {
	svc := newTestService(/*deps*/)
	leaseID := uuid.New(); ownerID := uuid.New()
	setupLease(svc, leaseID, ownerID, 0.10, 0.000333) // 10% multa, 1%/mês
	p := payment.Payment{
		LeaseID: leaseID, OwnerID: ownerID,
		DueDate: time.Now().AddDate(0, 0, 5), GrossAmount: 2000, Status: "PENDING", Type: "RENT",
	}
	out := svc.Enrich(context.Background(), p)
	assert.InDelta(t, 0, out.LateFeeAmount, 0.01)
	assert.InDelta(t, 0, out.InterestAmount, 0.01)
	assert.Equal(t, "PENDING", out.Status)
}

func TestService_Enrich_Atrasado(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLease(svc, leaseID, ownerID, 0.10, 0.001) // 10% multa, 0.1% ao dia
	p := payment.Payment{
		LeaseID: leaseID, OwnerID: ownerID,
		DueDate: time.Now().AddDate(0, 0, -10), GrossAmount: 2000, Status: "PENDING", Type: "RENT",
	}
	out := svc.Enrich(context.Background(), p)
	assert.InDelta(t, 200, out.LateFeeAmount, 0.01)   // 10% * 2000
	assert.InDelta(t, 20, out.InterestAmount, 0.5)    // ~10 dias * 0.1% * 2000 = 20
	assert.Equal(t, "LATE", out.Status)
}
```

Crie `newTestService` helper que monta `payment.NewService(repoMock, leaseReaderMock, tenantReaderMock, irrfMock)`.

- [ ] **Step 2: Rodar — FAIL**

- [ ] **Step 3: Definir interfaces leitoras em `payment/model.go`**

Adicionar no fim de `model.go`:
```go
// LeaseReader — subset de lease.Repository consumido pelo payment.Service.
// Definimos aqui para seguir ISP e evitar import cíclico caro.
type LeaseReader interface {
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*lease.Lease, error)
}

// TenantReader — idem.
type TenantReader interface {
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*tenant.Tenant, error)
}

// IRRFCalculator — fornecido pelo módulo fiscal.
type IRRFCalculator interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}
```

(Import `"github.com/inquilinotop/api/internal/lease"` e `tenant`.)

- [ ] **Step 4: Reescrever service.go**

```go
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
	irrf         IRRFCalculator
}

func NewService(repo Repository, lr LeaseReader, tr TenantReader, irrf IRRFCalculator) *Service {
	return &Service{repo: repo, leaseReader: lr, tenantReader: tr, irrf: irrf}
}

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	if in.LeaseID == uuid.Nil { return nil, fmt.Errorf("payment.svc: lease_id obrigatório") }
	if in.GrossAmount <= 0 { return nil, fmt.Errorf("payment.svc: gross_amount > 0") }
	valid := map[string]bool{"RENT": true, "DEPOSIT": true, "EXPENSE": true, "OTHER": true}
	if !valid[in.Type] { return nil, fmt.Errorf("payment.svc: type inválido") }
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) Get(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error) {
	p, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil { return nil, err }
	enriched := s.Enrich(ctx, *p)
	return &enriched, nil
}

func (s *Service) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error) {
	list, err := s.repo.ListByLease(ctx, leaseID, ownerID)
	if err != nil { return nil, err }
	for i, p := range list {
		list[i] = s.Enrich(ctx, p)
	}
	return list, nil
}

// Enrich aplica multa/juros como estado derivado (não escreve no DB).
// Base legal: Lei 8.245/91 — multa e juros são contratuais. Base dos juros
// é o gross puro, sem compor sobre multa (prática comum em locação).
func (s *Service) Enrich(ctx context.Context, p Payment) Payment {
	if p.PaidDate != nil {
		return p
	}
	if !time.Now().After(p.DueDate) {
		return p
	}
	l, err := s.leaseReader.GetByID(ctx, p.LeaseID, p.OwnerID)
	if err != nil {
		return p // leitura best-effort
	}
	daysLate := int(time.Since(p.DueDate).Hours() / 24)
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
	// Se paid_date preenchido, dispara MarkPaid (cálculo de multa/juros/irrf).
	if in.PaidDate != nil && in.Status == "PAID" {
		return s.markPaid(ctx, id, ownerID, *in.PaidDate)
	}
	return s.repo.Update(ctx, id, ownerID, in)
}

var errAlreadyPaid = errors.New("payment already paid")

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

	// Multa e juros baseados em paidDate (não "now")
	var lateFee, interest float64
	if paidDate.After(current.DueDate) {
		daysLate := int(paidDate.Sub(current.DueDate).Hours() / 24)
		if daysLate > 0 {
			lateFee = round2(current.GrossAmount * l.LateFeePercent)
			interest = round2(current.GrossAmount * l.DailyInterestPercent * float64(daysLate))
		}
	}

	// IRRF: apenas em RENT quando tenant é PJ.
	// IN RFB 1.500/2014 — retenção pela fonte pagadora (locatário PJ).
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

func round2(x float64) float64 { return math.Round(x*100) / 100 }

// Helpers para tipos "não-vazios" — usados em Enrich/helpers de lease.
var _ = lease.Lease{}
var _ = tenant.Tenant{}
```

- [ ] **Step 5: Atualizar service_test.go completamente**

Todo `payment.NewService(mockRepo)` antigo vira `payment.NewService(mockRepo, mockLease, mockTenant, mockIRRF)`. Aplique em todos os testes.

Para testes de `Create`/`Get`/`Update` existentes, os mocks de lease/tenant/irrf podem ser vazios — `newTestService(...)` encapsula.

- [ ] **Step 6: Rodar**

```bash
cd backend && go test ./internal/payment/ -run Enrich
cd backend && go test ./internal/payment/
```

- [ ] **Step 7: Commit**

```bash
cd backend && git add internal/payment/model.go internal/payment/service.go internal/payment/service_test.go
git commit -m "feat(payment): Enrich on-read + markPaid with IRRF (PJ tenant)"
```

---

### Task 18: Payment service — GenerateMonth

**Files:**
- Modify: `backend/internal/payment/service.go`
- Modify: `backend/internal/payment/service_test.go`

- [ ] **Step 1: Escrever testes**

```go
func TestService_GenerateMonth_RentESemIPTU(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026,1,15,0,0,0,0,time.UTC), false, 0)

	ps, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.NoError(t, err)
	require.Len(t, ps, 1)
	assert.Equal(t, "RENT", ps[0].Type)
	assert.Equal(t, "2026-04", *ps[0].Competency)
	assert.Equal(t, 15, ps[0].DueDate.Day())
}

func TestService_GenerateMonth_ComIPTU(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026,1,10,0,0,0,0,time.UTC), true, 1800)

	ps, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.NoError(t, err)
	require.Len(t, ps, 2)
	var iptu *payment.Payment
	for i, p := range ps {
		if p.Type == "EXPENSE" { iptu = &ps[i] }
	}
	require.NotNil(t, iptu)
	assert.InDelta(t, 150.0, iptu.GrossAmount, 0.01) // 1800/12
}

func TestService_GenerateMonth_Idempotente(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026,1,15,0,0,0,0,time.UTC), false, 0)

	ps1, _ := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	ps2, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.NoError(t, err)
	assert.Equal(t, ps1[0].ID, ps2[0].ID)
}

func TestService_GenerateMonth_LeaseEnded(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseEnded(svc, leaseID, ownerID) // Status = ENDED

	_, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not active")
}

func TestService_GenerateMonth_MonthForaRange(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026,1,15,0,0,0,0,time.UTC), false, 0)

	_, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2025-01")
	require.Error(t, err)
}

func TestService_GenerateMonth_IPTUMissing(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	// iptu_reimbursable=true, MAS AnnualIPTUAmount=nil
	setupLeaseIPTUMissing(svc, leaseID, ownerID)

	_, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "iptu")
}

func TestService_GenerateMonth_DiaInexistenteNoMes(t *testing.T) {
	svc := newTestService(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	// start_date dia 31, mês alvo é fev
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026,1,31,0,0,0,0,time.UTC), false, 0)

	ps, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-02")
	require.NoError(t, err)
	assert.Equal(t, 28, ps[0].DueDate.Day()) // último dia de fev/2026
}
```

Implemente helpers `setupLeaseBasic`, `setupLeaseEnded`, etc., que adicionam o Lease ao `mockLeaseReader` — reaproveite o padrão da task anterior.

- [ ] **Step 2: Rodar — FAIL**

- [ ] **Step 3: Implementar GenerateMonth**

Adicionar a `service.go`:
```go
// GenerateMonth cria (idempotentemente) o Payment de aluguel + eventual IPTU
// parcelado para a competência informada. Chave de idempotência:
// (lease_id, competency, type) — garantida por unique index no DB.
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

	// Valida range do lease
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

	// RENT
	rentInput := CreatePaymentInput{
		LeaseID: leaseID, DueDate: dueDate, GrossAmount: l.RentAmount,
		Type: "RENT", Competency: &month,
	}
	p, _, err := s.repo.CreateIfAbsent(ctx, ownerID, rentInput)
	if err != nil {
		return nil, fmt.Errorf("payment.svc: generate rent: %w", err)
	}
	results = append(results, *p)

	// EXPENSE (IPTU) se aplicável
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
```

- [ ] **Step 4: Rodar — PASS**

```bash
cd backend && go test ./internal/payment/ -run GenerateMonth
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/payment/service.go internal/payment/service_test.go
git commit -m "feat(payment): GenerateMonth (idempotent) with optional IPTU reimbursement"
```

---

### Task 19: Payment handler — /generate + /receipt

**Files:**
- Modify: `backend/internal/payment/handler.go`
- Modify: `backend/internal/payment/handler_test.go`

- [ ] **Step 1: Testes**

```go
func TestHandler_Generate_Sucesso(t *testing.T) {
	h := newTestHandler(...)
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasicInHandler(h, leaseID, ownerID)

	req := httptest.NewRequest("POST", "/?month=2026-04", nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), ownerID))
	req = withURLParam(req, "leaseId", leaseID.String())
	w := httptest.NewRecorder()

	h.Generate(w, req)
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestHandler_Generate_MonthInválido(t *testing.T) {
	h := newTestHandler(...)
	req := httptest.NewRequest("POST", "/?month=abril", nil)
	req = withURLParam(req, "leaseId", uuid.New().String())
	req = req.WithContext(auth.WithOwnerID(req.Context(), uuid.New()))
	w := httptest.NewRecorder()
	h.Generate(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "INVALID_MONTH")
}

func TestHandler_Receipt_NãoPago(t *testing.T) {
	h := newTestHandler(...)
	p := seedPendingPayment(h, ...)
	req := httptest.NewRequest("GET", "/", nil)
	req = withURLParam(req, "id", p.ID.String())
	req = req.WithContext(auth.WithOwnerID(req.Context(), p.OwnerID))
	w := httptest.NewRecorder()
	h.Receipt(w, req)
	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "PAYMENT_NOT_PAID")
}
```

- [ ] **Step 2: Adicionar Receipt struct + service method**

Em `backend/internal/payment/model.go`:
```go
type Receipt struct {
	PaymentID  uuid.UUID  `json:"payment_id"`
	Competency *string    `json:"competency,omitempty"`
	IssuedAt   time.Time  `json:"issued_at"`
	Owner      Party      `json:"owner"`
	Tenant     Party      `json:"tenant"`
	Unit       UnitRef    `json:"unit"`
	Amounts    Amounts    `json:"amounts"`
	PaidDate   time.Time  `json:"paid_date"`
	LegalNote  string     `json:"legal_note"`
}
type Party struct {
	Name       string  `json:"name"`
	Document   *string `json:"document,omitempty"`
	PersonType *string `json:"person_type,omitempty"`
}
type UnitRef struct {
	Label            *string `json:"label,omitempty"`
	PropertyAddress  *string `json:"property_address,omitempty"`
}
type Amounts struct {
	Gross         float64 `json:"gross"`
	LateFee       float64 `json:"late_fee"`
	Interest      float64 `json:"interest"`
	IRRFWithheld  float64 `json:"irrf_withheld"`
	NetPaid       float64 `json:"net_paid"`
}
```

Para montar o Receipt, o service precisa de mais dados (owner=user, unit, property). Isso requer mais leitores. Para manter a spec simples, o receipt monta do que já temos via `leaseReader` + `tenantReader` + `ownerReader` (users). Preferência aqui: **receipt na primeira versão** expõe apenas o que o payment service consegue ler com as deps atuais. Campos de property/unit são preenchidos se disponíveis; senão ficam `nil`.

Adicionar ao payment/model.go:
```go
type OwnerReader interface {
	GetByID(ctx context.Context, id uuid.UUID) (*OwnerSummary, error)
}
type OwnerSummary struct {
	ID       uuid.UUID
	Name     string
	Document *string
}

type UnitReader interface {
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*UnitSummary, error)
}
type UnitSummary struct {
	ID              uuid.UUID
	Label           *string
	PropertyAddress *string
}
```

E no Service:
```go
type Service struct {
	repo         Repository
	leaseReader  LeaseReader
	tenantReader TenantReader
	unitReader   UnitReader
	ownerReader  OwnerReader
	irrf         IRRFCalculator
}
```

- [ ] **Step 3: Implementar BuildReceipt**

```go
func (s *Service) BuildReceipt(ctx context.Context, id, ownerID uuid.UUID) (*Receipt, error) {
	p, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil { return nil, fmt.Errorf("payment.svc: %w", err) }
	if p.Status != "PAID" || p.PaidDate == nil {
		return nil, fmt.Errorf("payment.svc: payment not paid")
	}
	l, err := s.leaseReader.GetByID(ctx, p.LeaseID, ownerID)
	if err != nil { return nil, fmt.Errorf("payment.svc: load lease: %w", err) }
	tn, err := s.tenantReader.GetByID(ctx, l.TenantID, ownerID)
	if err != nil { return nil, fmt.Errorf("payment.svc: load tenant: %w", err) }
	ow, err := s.ownerReader.GetByID(ctx, ownerID)
	if err != nil { return nil, fmt.Errorf("payment.svc: load owner: %w", err) }
	un, err := s.unitReader.GetByID(ctx, l.UnitID, ownerID)
	if err != nil { return nil, fmt.Errorf("payment.svc: load unit: %w", err) }

	pt := tn.PersonType
	net := 0.0
	if p.NetAmount != nil { net = *p.NetAmount }

	return &Receipt{
		PaymentID:  p.ID,
		Competency: p.Competency,
		IssuedAt:   time.Now(),
		Owner:      Party{Name: ow.Name, Document: ow.Document},
		Tenant:     Party{Name: tn.Name, Document: tn.Document, PersonType: &pt},
		Unit:       UnitRef{Label: un.Label, PropertyAddress: un.PropertyAddress},
		Amounts: Amounts{
			Gross: p.GrossAmount, LateFee: p.LateFeeAmount, Interest: p.InterestAmount,
			IRRFWithheld: p.IRRFAmount, NetPaid: net,
		},
		PaidDate:  *p.PaidDate,
		LegalNote: "Recibo emitido conforme Lei 8.245/91, art. 22, IV.",
	}, nil
}
```

- [ ] **Step 4: Handlers**

Em `handler.go`:
```go
// @Summary Gera payments (RENT + eventual IPTU) da competência
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param leaseId path string true "ID do contrato"
// @Param month query string true "Competência YYYY-MM"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /leases/{leaseId}/payments/generate [post]
func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	month := r.URL.Query().Get("month")
	if month == "" {
		httputil.Err(w, http.StatusBadRequest, "INVALID_MONTH", "query param month obrigatório")
		return
	}
	ps, err := h.svc.GenerateMonth(r.Context(), leaseID, ownerID, month)
	if err != nil {
		switch {
		case strings.Contains(err.Error(), "month"):
			httputil.Err(w, http.StatusBadRequest, "INVALID_MONTH", err.Error())
		case strings.Contains(err.Error(), "not active"):
			httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", err.Error())
		case strings.Contains(err.Error(), "iptu"):
			httputil.Err(w, http.StatusConflict, "IPTU_MISSING", err.Error())
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
		default:
			httputil.Err(w, http.StatusInternalServerError, "GENERATE_FAILED", err.Error())
		}
		return
	}
	httputil.Created(w, ps)
}

// @Summary Recibo mensal (status=PAID)
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /payments/{id}/receipt [get]
func (h *Handler) Receipt(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	rec, err := h.svc.BuildReceipt(r.Context(), id, ownerID)
	if err != nil {
		if strings.Contains(err.Error(), "not paid") {
			httputil.Err(w, http.StatusConflict, "PAYMENT_NOT_PAID", "payment não está PAID")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "RECEIPT_FAILED", err.Error())
		return
	}
	httputil.OK(w, rec)
}
```

Atualizar o `Update` handler — tratar `ALREADY_PAID`:
```go
if h.svc.IsAlreadyPaid(err) {
    httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "pagamento já foi registrado")
    return
}
```

Registrar rotas em `Register`:
```go
r.With(authMW).Post("/api/v1/leases/{leaseId}/payments/generate", h.Generate)
r.With(authMW).Get("/api/v1/payments/{id}/receipt", h.Receipt)
```

- [ ] **Step 5: Rodar**

```bash
cd backend && go test ./internal/payment/
```

- [ ] **Step 6: Commit**

```bash
cd backend && git add internal/payment/
git commit -m "feat(payment): /generate and /receipt endpoints + BuildReceipt service"
```

---


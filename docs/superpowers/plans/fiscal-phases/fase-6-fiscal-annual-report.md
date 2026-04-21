## Fase 6 — Fiscal: AnnualReport

### Task 20: Fiscal service — AnnualReport

**Files:**
- Modify: `backend/internal/fiscal/model.go`
- Modify: `backend/internal/fiscal/repository.go`
- Create: `backend/internal/fiscal/service.go`
- Create: `backend/internal/fiscal/service_test.go`

- [ ] **Step 1: Escrever testes**

`service_test.go`:
```go
func TestService_AnnualReport_SeparaPFePJ(t *testing.T) {
	svc := newFiscalTestService() // monta com 4 mocks
	seedAnnualData(svc, ...)
	// ownerID, leasePF (tenant PF, 2 payments PAID), leasePJ (tenant PJ, 2 payments PAID com IRRF)

	rep, err := svc.AnnualReport(context.Background(), ownerID, 2026)
	require.NoError(t, err)
	require.Len(t, rep.Leases, 2)
	assert.Equal(t, 2026, rep.Year)
	// Totais corretos
	assert.InDelta(t, esperadoPF, rep.Totals.ReceivedFromPF, 0.01)
	assert.InDelta(t, esperadoPJ, rep.Totals.ReceivedFromPJ, 0.01)
	assert.InDelta(t, esperadoIRRF, rep.Totals.TotalIRRFCredit, 0.01)
}

func TestService_AnnualReport_AnoVazio(t *testing.T) {
	svc := newFiscalTestService()
	rep, err := svc.AnnualReport(context.Background(), uuid.New(), 2099)
	require.NoError(t, err)
	assert.Len(t, rep.Leases, 0)
	assert.Zero(t, rep.Totals.ReceivedFromPF)
}
```

- [ ] **Step 2: Adicionar types em model.go**

```go
type AnnualReport struct {
	Year   int                 `json:"year"`
	Owner  ReportParty         `json:"owner"`
	Leases []AnnualLeaseReport `json:"leases"`
	Totals AnnualTotals        `json:"totals"`
}

type ReportParty struct {
	Name     string  `json:"name"`
	Document *string `json:"document,omitempty"`
}

type AnnualLeaseReport struct {
	LeaseID            uuid.UUID         `json:"lease_id"`
	Tenant             ReportParty       `json:"tenant"`
	TenantPersonType   string            `json:"tenant_person_type"`
	Unit               ReportUnitRef     `json:"unit"`
	TotalReceived      float64           `json:"total_received"`
	TotalIRRFWithheld  float64           `json:"total_irrf_withheld"`
	Category           string            `json:"category"`      // PJ_WITHHELD | CARNE_LEAO
	DeductibleIPTUPaid float64           `json:"deductible_iptu_paid"`
	MonthlyBreakdown   []MonthlyBreakdown `json:"monthly_breakdown"`
}

type ReportUnitRef struct {
	Label           *string `json:"label,omitempty"`
	PropertyAddress *string `json:"property_address,omitempty"`
}

type MonthlyBreakdown struct {
	Competency string  `json:"competency"`
	Gross      float64 `json:"gross"`
	Fees       float64 `json:"fees"`
	IRRF       float64 `json:"irrf"`
	Net        float64 `json:"net"`
}

type AnnualTotals struct {
	ReceivedFromPJ  float64 `json:"received_from_pj"`
	ReceivedFromPF  float64 `json:"received_from_pf"`
	TotalIRRFCredit float64 `json:"total_irrf_credit"`
	DeductibleIPTU  float64 `json:"deductible_iptu"`
}

// Repository para agregação
type AggregateRepository interface {
	ListPaidPaymentsForYear(ctx context.Context, ownerID uuid.UUID, year int) ([]PaidPayment, error)
	ListTaxExpensesPaidInYear(ctx context.Context, ownerID uuid.UUID, year int) ([]TaxExpense, error)
	ListOwnerLeases(ctx context.Context, ownerID uuid.UUID) ([]LeaseSummary, error)
	GetOwner(ctx context.Context, ownerID uuid.UUID) (*ReportParty, error)
}

type PaidPayment struct {
	PaymentID      uuid.UUID
	LeaseID        uuid.UUID
	Competency     string
	GrossAmount    float64
	LateFeeAmount  float64
	InterestAmount float64
	IRRFAmount     float64
	NetAmount      float64
	Type           string
}

type TaxExpense struct {
	UnitID      uuid.UUID
	Amount      float64
	PaidYear    int
}

type LeaseSummary struct {
	LeaseID          uuid.UUID
	TenantID         uuid.UUID
	TenantName       string
	TenantDocument   *string
	TenantPersonType string
	UnitID           uuid.UUID
	UnitLabel        *string
	PropertyAddress  *string
}
```

- [ ] **Step 3: Implementar queries em `repository.go`**

Adicionar ao `pgBracketsRepository` um novo tipo `pgAggregateRepository`:

```go
type pgAggregateRepository struct{ db *db.DB }

func NewAggregateRepository(database *db.DB) AggregateRepository {
	return &pgAggregateRepository{db: database}
}

func (r *pgAggregateRepository) ListPaidPaymentsForYear(ctx context.Context, ownerID uuid.UUID, year int) ([]PaidPayment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, lease_id, competency, gross_amount, late_fee_amount, interest_amount, irrf_amount,
		        COALESCE(net_amount, gross_amount + late_fee_amount + interest_amount - irrf_amount), type
		 FROM payments
		 WHERE owner_id=$1 AND status='PAID' AND competency IS NOT NULL
		   AND substring(competency FROM 1 FOR 4)=$2`,
		ownerID, fmt.Sprintf("%04d", year),
	)
	if err != nil { return nil, fmt.Errorf("fiscal.agg.repo: paid payments: %w", err) }
	defer rows.Close()
	var list []PaidPayment
	for rows.Next() {
		var p PaidPayment
		if err := rows.Scan(&p.PaymentID, &p.LeaseID, &p.Competency,
			&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount, &p.Type); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

func (r *pgAggregateRepository) ListTaxExpensesPaidInYear(ctx context.Context, ownerID uuid.UUID, year int) ([]TaxExpense, error) {
	// Expenses atuais não têm paid_date nem year — o agg aqui considera todas tax-expenses ativas.
	// Refinamento: filtrar por due_date year. Por ora, conservador: soma de expenses TAX is_active.
	rows, err := r.db.Pool.Query(ctx,
		`SELECT unit_id, amount
		 FROM expenses
		 WHERE owner_id=$1 AND category='TAX' AND is_active=true
		   AND EXTRACT(YEAR FROM due_date) = $2`,
		ownerID, year,
	)
	if err != nil { return nil, fmt.Errorf("fiscal.agg.repo: tax expenses: %w", err) }
	defer rows.Close()
	var list []TaxExpense
	for rows.Next() {
		var e TaxExpense
		if err := rows.Scan(&e.UnitID, &e.Amount); err != nil { return nil, err }
		e.PaidYear = year
		list = append(list, e)
	}
	return list, rows.Err()
}

func (r *pgAggregateRepository) ListOwnerLeases(ctx context.Context, ownerID uuid.UUID) ([]LeaseSummary, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT l.id, l.tenant_id, t.name, t.document, t.person_type,
		        u.id, u.label, p.address_line
		 FROM leases l
		 JOIN tenants t ON t.id = l.tenant_id
		 JOIN units u ON u.id = l.unit_id
		 JOIN properties p ON p.id = u.property_id
		 WHERE l.owner_id=$1`,
		ownerID,
	)
	if err != nil { return nil, fmt.Errorf("fiscal.agg.repo: owner leases: %w", err) }
	defer rows.Close()
	var list []LeaseSummary
	for rows.Next() {
		var s LeaseSummary
		if err := rows.Scan(&s.LeaseID, &s.TenantID, &s.TenantName, &s.TenantDocument, &s.TenantPersonType,
			&s.UnitID, &s.UnitLabel, &s.PropertyAddress); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *pgAggregateRepository) GetOwner(ctx context.Context, ownerID uuid.UUID) (*ReportParty, error) {
	var p ReportParty
	err := r.db.Pool.QueryRow(ctx,
		`SELECT email, NULL::text FROM users WHERE id=$1`, ownerID,
	).Scan(&p.Name, &p.Document)
	if err != nil { return nil, fmt.Errorf("fiscal.agg.repo: owner: %w", err) }
	return &p, nil
}
```

Schema confirmado: `users(email)` — sem colunas `name`/`document`, então o relatório usa `email` como identificação do owner e deixa `Document` como `NULL`. A coluna de endereço da property é `properties.address_line` (migration 000003).

- [ ] **Step 4: Implementar service**

`backend/internal/fiscal/service.go`:
```go
package fiscal

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	agg AggregateRepository
}

func NewService(agg AggregateRepository) *Service {
	return &Service{agg: agg}
}

func (s *Service) AnnualReport(ctx context.Context, ownerID uuid.UUID, year int) (*AnnualReport, error) {
	if year < 1900 || year > 2999 {
		return nil, fmt.Errorf("fiscal.svc: year inválido")
	}

	owner, err := s.agg.GetOwner(ctx, ownerID)
	if err != nil { return nil, fmt.Errorf("fiscal.svc: %w", err) }

	leases, err := s.agg.ListOwnerLeases(ctx, ownerID)
	if err != nil { return nil, fmt.Errorf("fiscal.svc: %w", err) }

	payments, err := s.agg.ListPaidPaymentsForYear(ctx, ownerID, year)
	if err != nil { return nil, fmt.Errorf("fiscal.svc: %w", err) }

	taxes, err := s.agg.ListTaxExpensesPaidInYear(ctx, ownerID, year)
	if err != nil { return nil, fmt.Errorf("fiscal.svc: %w", err) }

	report := &AnnualReport{Year: year, Owner: *owner, Leases: []AnnualLeaseReport{}}

	leaseIndex := map[uuid.UUID]*AnnualLeaseReport{}
	for _, ls := range leases {
		r := AnnualLeaseReport{
			LeaseID: ls.LeaseID,
			Tenant: ReportParty{Name: ls.TenantName, Document: ls.TenantDocument},
			TenantPersonType: ls.TenantPersonType,
			Unit: ReportUnitRef{Label: ls.UnitLabel, PropertyAddress: ls.PropertyAddress},
			Category: "CARNE_LEAO",
			MonthlyBreakdown: []MonthlyBreakdown{},
		}
		if ls.TenantPersonType == "PJ" {
			r.Category = "PJ_WITHHELD"
		}
		leaseIndex[ls.LeaseID] = &r
	}

	monthlyByLease := map[uuid.UUID]map[string]*MonthlyBreakdown{}
	for _, p := range payments {
		lr, ok := leaseIndex[p.LeaseID]
		if !ok { continue } // lease legada sem join
		// Só RENT entra no relatório (EXPENSE de repasse IPTU não é receita do locador)
		if p.Type != "RENT" { continue }
		if _, ok := monthlyByLease[p.LeaseID]; !ok {
			monthlyByLease[p.LeaseID] = map[string]*MonthlyBreakdown{}
		}
		mb := monthlyByLease[p.LeaseID][p.Competency]
		if mb == nil {
			mb = &MonthlyBreakdown{Competency: p.Competency}
			monthlyByLease[p.LeaseID][p.Competency] = mb
		}
		mb.Gross += p.GrossAmount
		mb.Fees  += p.LateFeeAmount + p.InterestAmount
		mb.IRRF  += p.IRRFAmount
		mb.Net   += p.NetAmount

		lr.TotalReceived     += p.GrossAmount + p.LateFeeAmount + p.InterestAmount
		lr.TotalIRRFWithheld += p.IRRFAmount
	}

	// Materializar breakdown ordenado
	for leaseID, months := range monthlyByLease {
		lr := leaseIndex[leaseID]
		for _, mb := range months {
			lr.MonthlyBreakdown = append(lr.MonthlyBreakdown, *mb)
		}
		// Opcional: sort por competency
	}

	// IPTU por lease — via unit
	unitToLease := map[uuid.UUID]uuid.UUID{}
	for _, ls := range leases {
		unitToLease[ls.UnitID] = ls.LeaseID
	}
	for _, te := range taxes {
		if lID, ok := unitToLease[te.UnitID]; ok {
			if lr, ok := leaseIndex[lID]; ok {
				lr.DeductibleIPTUPaid += te.Amount
			}
		}
	}

	// Materializar lista + totais (só leases com recebimentos ou iptu)
	var totals AnnualTotals
	for _, lr := range leaseIndex {
		if lr.TotalReceived == 0 && lr.DeductibleIPTUPaid == 0 {
			continue
		}
		report.Leases = append(report.Leases, *lr)
		if lr.Category == "PJ_WITHHELD" {
			totals.ReceivedFromPJ += lr.TotalReceived
		} else {
			totals.ReceivedFromPF += lr.TotalReceived
		}
		totals.TotalIRRFCredit += lr.TotalIRRFWithheld
		totals.DeductibleIPTU  += lr.DeductibleIPTUPaid
	}
	report.Totals = totals
	return report, nil
}
```

- [ ] **Step 5: Rodar**

```bash
cd backend && go test ./internal/fiscal/
```

- [ ] **Step 6: Commit**

```bash
cd backend && git add internal/fiscal/
git commit -m "feat(fiscal): AnnualReport service + pg aggregate repository"
```

---

### Task 21: Fiscal handler — GET /annual-report

**Files:**
- Create: `backend/internal/fiscal/handler.go`
- Create: `backend/internal/fiscal/handler_test.go`

- [ ] **Step 1: Teste**

```go
func TestHandler_AnnualReport_YearInválido(t *testing.T) {
	h := fiscal.NewHandler(fiscal.NewService(&mockAggRepo{}))
	req := httptest.NewRequest("GET", "/?year=xx", nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), uuid.New()))
	w := httptest.NewRecorder()
	h.AnnualReport(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_AnnualReport_Sucesso(t *testing.T) {
	agg := &mockAggRepo{ownerName: "João"}
	h := fiscal.NewHandler(fiscal.NewService(agg))
	req := httptest.NewRequest("GET", "/?year=2026", nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), uuid.New()))
	w := httptest.NewRecorder()
	h.AnnualReport(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "2026")
}
```

- [ ] **Step 2: handler.go**

```go
package fiscal

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/fiscal/annual-report", h.AnnualReport)
}

// @Summary Relatório fiscal anual para DIRPF
// @Tags fiscal
// @Security BearerAuth
// @Produce json
// @Param year query int true "Ano (ex: 2026)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /fiscal/annual-report [get]
func (h *Handler) AnnualReport(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_YEAR", "year inválido")
		return
	}
	rep, err := h.svc.AnnualReport(r.Context(), ownerID, year)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "REPORT_FAILED", err.Error())
		return
	}
	httputil.OK(w, rep)
}
```

- [ ] **Step 3: Rodar**

```bash
cd backend && go test ./internal/fiscal/
```

- [ ] **Step 4: CLAUDE.md**

`backend/internal/fiscal/CLAUDE.md`:
```markdown
# fiscal — Núcleo Fiscal Transversal

Agregação do relatório fiscal anual + tabela IRRF versionada.

## Estrutura

- `IRRFTable` (interface) — consumida pelo `payment.Service` no MarkPaid.
- `BracketsRepository` (pg) — lê `irrf_brackets` com filtro `valid_from`.
- `AggregateRepository` (pg) — agrega payments, tax expenses e leases do owner.
- `AnnualReport` — resposta agregada por Lease: categoria (PJ_WITHHELD|CARNE_LEAO),
  total recebido, IRRF retido, IPTU dedutível.

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/fiscal/annual-report?year=YYYY | AnnualReport |

## Gotchas

- Somente payments `type=RENT` entram no total do relatório (EXPENSE=repasse IPTU não é receita do locador).
- `irrf_brackets` é seed estática — atualização requer nova linha com `valid_from` posterior.
- `deductible_iptu_paid` usa `expenses(category=TAX)` por ano de `due_date` (aproximação — expenses não têm paid_date).
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/fiscal/handler.go internal/fiscal/handler_test.go internal/fiscal/CLAUDE.md
git commit -m "feat(fiscal): handler + register route + docs"
```

---


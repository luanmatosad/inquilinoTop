## Fase 2 — Lease: campos fiscais + reajuste

### Task 9: Lease model — campos fiscais + Readjustment

**Files:**
- Modify: `backend/internal/lease/model.go`
- Create: `backend/internal/lease/readjustment.go`

- [ ] **Step 1: Escrever teste failing no service_test**

Adicionar em `backend/internal/lease/service_test.go`:

```go
func TestService_Readjust_PercentagemInválida(t *testing.T) {
	mock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	svc := lease.NewService(mock, readjMock)
	ownerID, leaseID := uuid.New(), uuid.New()
	mock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OwnerID: ownerID, Status: "ACTIVE", RentAmount: 2000,
	}

	_, err := svc.Readjust(context.Background(), leaseID, ownerID, lease.ReadjustInput{
		Percentage: 0, AppliedAt: time.Now(),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "percentage")
}
```

- [ ] **Step 2: Rodar — deve falhar compilação**

```bash
cd backend && go test ./internal/lease/ -run Readjust
```
Expected: FAIL — tipos não existem.

- [ ] **Step 3: Criar `readjustment.go`**

`backend/internal/lease/readjustment.go`:
```go
package lease

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Readjustment struct {
	ID         uuid.UUID `json:"id"`
	LeaseID    uuid.UUID `json:"lease_id"`
	OwnerID    uuid.UUID `json:"owner_id"`
	AppliedAt  time.Time `json:"applied_at"`
	OldAmount  float64   `json:"old_amount"`
	NewAmount  float64   `json:"new_amount"`
	Percentage float64   `json:"percentage"`
	IndexName  *string   `json:"index_name,omitempty"`
	Notes      *string   `json:"notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type ReadjustInput struct {
	Percentage float64   `json:"percentage"`
	IndexName  *string   `json:"index_name,omitempty"`
	AppliedAt  time.Time `json:"applied_at"`
	Notes      *string   `json:"notes,omitempty"`
}

type ReadjustmentRepository interface {
	Create(ctx context.Context, r *Readjustment) (*Readjustment, error)
	ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Readjustment, error)
}
```

- [ ] **Step 4: Estender `model.go`**

Adicionar em `Lease`:
```go
type Lease struct {
	// ... campos atuais ...
	LateFeePercent       float64  `json:"late_fee_percent"`
	DailyInterestPercent float64  `json:"daily_interest_percent"`
	IPTUReimbursable     bool     `json:"iptu_reimbursable"`
	AnnualIPTUAmount     *float64 `json:"annual_iptu_amount,omitempty"`
	IPTUYear             *int     `json:"iptu_year,omitempty"`
}
```

E nos inputs `CreateLeaseInput` e `UpdateLeaseInput`, adicionar os 5 campos como opcionais (ponteiros onde couber).

`CreateLeaseInput`:
```go
type CreateLeaseInput struct {
	UnitID               uuid.UUID  `json:"unit_id"`
	TenantID             uuid.UUID  `json:"tenant_id"`
	StartDate            time.Time  `json:"start_date"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	RentAmount           float64    `json:"rent_amount"`
	DepositAmount        *float64   `json:"deposit_amount,omitempty"`
	LateFeePercent       float64    `json:"late_fee_percent,omitempty"`
	DailyInterestPercent float64    `json:"daily_interest_percent,omitempty"`
	IPTUReimbursable     bool       `json:"iptu_reimbursable,omitempty"`
	AnnualIPTUAmount     *float64   `json:"annual_iptu_amount,omitempty"`
	IPTUYear             *int       `json:"iptu_year,omitempty"`
}
```

`UpdateLeaseInput` recebe os mesmos 5 campos adicionais.

- [ ] **Step 5: Commit parcial**

```bash
cd backend && git add internal/lease/model.go internal/lease/readjustment.go
git commit -m "feat(lease): add fiscal fields and Readjustment model"
```

---

### Task 10: Lease repository — persistir campos fiscais

**Files:**
- Modify: `backend/internal/lease/repository.go`
- Modify: `backend/internal/lease/repository_test.go`

- [ ] **Step 1: Adicionar teste integração**

`backend/internal/lease/repository_test.go`:
```go
func TestRepository_CreateLease_ComCamposFiscais(t *testing.T) {
	d := testDB(t)
	repo := lease.NewRepository(d)
	ownerID := seedUser(t, d)
	unitID := seedUnit(t, d, ownerID)
	tenantID := seedTenant(t, d, ownerID)

	iptu := 1800.0
	year := 2026
	l, err := repo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID,
		StartDate: time.Now(), RentAmount: 2000,
		LateFeePercent: 0.10, DailyInterestPercent: 0.000333,
		IPTUReimbursable: true, AnnualIPTUAmount: &iptu, IPTUYear: &year,
	})
	require.NoError(t, err)
	assert.InDelta(t, 0.10, l.LateFeePercent, 0.0001)
	assert.True(t, l.IPTUReimbursable)
	require.NotNil(t, l.AnnualIPTUAmount)
	assert.InDelta(t, 1800.0, *l.AnnualIPTUAmount, 0.01)
}
```

- [ ] **Step 2: Rodar — FAIL**

```bash
cd backend && go test ./internal/lease/ -run CamposFiscais
```
Expected: FAIL — colunas não selecionadas.

- [ ] **Step 3: Atualizar queries em `repository.go`**

Todas as queries SELECT/INSERT/UPDATE precisam incluir os 5 campos novos, na mesma ordem. Exemplo Create:

```go
func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO leases (owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount,
		                     late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount,
		           late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year,
		           status, is_active, created_at, updated_at`,
		ownerID, in.UnitID, in.TenantID, in.StartDate, in.EndDate, in.RentAmount, in.DepositAmount,
		in.LateFeePercent, in.DailyInterestPercent, in.IPTUReimbursable, in.AnnualIPTUAmount, in.IPTUYear,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount,
		&l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: create: %w", err)
	}
	return &l, nil
}
```

Aplicar o padrão também em `GetByID`, `List`, `Update`, `End`, `Renew`. O SELECT list pode ficar numa const `const leaseCols = "id, owner_id, unit_id, ..."` para DRY — fique à vontade.

- [ ] **Step 4: Rodar — PASS**

```bash
cd backend && go test ./internal/lease/ -run CamposFiscais
```

- [ ] **Step 5: Rodar suite completa de lease**

```bash
cd backend && go test ./internal/lease/...
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add internal/lease/repository.go internal/lease/repository_test.go
git commit -m "feat(lease): persist fiscal fields in all repository queries"
```

---

### Task 11: Readjustment repository (pg impl)

**Files:**
- Modify: `backend/internal/lease/repository.go` (add `pgReadjustmentRepository`)
- Create: `backend/internal/lease/readjustment_test.go`

- [ ] **Step 1: Escrever teste integração**

`backend/internal/lease/readjustment_test.go`:
```go
package lease_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadjustmentRepo_CreateAndList(t *testing.T) {
	d := testDB(t)
	repo := lease.NewReadjustmentRepository(d)
	leaseRepo := lease.NewRepository(d)
	ownerID := seedUser(t, d)
	unitID := seedUnit(t, d, ownerID)
	tenantID := seedTenant(t, d, ownerID)
	l, err := leaseRepo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 2000,
	})
	require.NoError(t, err)

	idx := "IGPM"
	r, err := repo.Create(context.Background(), &lease.Readjustment{
		LeaseID: l.ID, OwnerID: ownerID,
		AppliedAt: time.Now(), OldAmount: 2000, NewAmount: 2100,
		Percentage: 0.05, IndexName: &idx,
	})
	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, r.ID)

	list, err := repo.ListByLease(context.Background(), l.ID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}
```

- [ ] **Step 2: Rodar — FAIL**

```bash
cd backend && go test ./internal/lease/ -run Readjustment
```

- [ ] **Step 3: Implementar em `repository.go`**

Adicionar ao final do arquivo:
```go
type pgReadjustmentRepository struct{ db *db.DB }

func NewReadjustmentRepository(database *db.DB) ReadjustmentRepository {
	return &pgReadjustmentRepository{db: database}
}

func (r *pgReadjustmentRepository) Create(ctx context.Context, in *Readjustment) (*Readjustment, error) {
	var out Readjustment
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO lease_readjustments
		   (lease_id, owner_id, applied_at, old_amount, new_amount, percentage, index_name, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING id, lease_id, owner_id, applied_at, old_amount, new_amount, percentage, index_name, notes, created_at`,
		in.LeaseID, in.OwnerID, in.AppliedAt, in.OldAmount, in.NewAmount, in.Percentage, in.IndexName, in.Notes,
	).Scan(&out.ID, &out.LeaseID, &out.OwnerID, &out.AppliedAt, &out.OldAmount, &out.NewAmount,
		&out.Percentage, &out.IndexName, &out.Notes, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.readj.repo: create: %w", err)
	}
	return &out, nil
}

func (r *pgReadjustmentRepository) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Readjustment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, lease_id, owner_id, applied_at, old_amount, new_amount, percentage, index_name, notes, created_at
		 FROM lease_readjustments WHERE lease_id=$1 AND owner_id=$2 ORDER BY applied_at DESC`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.readj.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Readjustment
	for rows.Next() {
		var r Readjustment
		if err := rows.Scan(&r.ID, &r.LeaseID, &r.OwnerID, &r.AppliedAt, &r.OldAmount, &r.NewAmount,
			&r.Percentage, &r.IndexName, &r.Notes, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("lease.readj.repo: list scan: %w", err)
		}
		list = append(list, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lease.readj.repo: list rows: %w", err)
	}
	return list, nil
}
```

- [ ] **Step 4: Rodar — PASS**

```bash
cd backend && go test ./internal/lease/ -run Readjustment
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/lease/repository.go internal/lease/readjustment_test.go
git commit -m "feat(lease): add pgReadjustmentRepository"
```

---

### Task 12: Lease service — Readjust (transacional)

**Files:**
- Modify: `backend/internal/lease/service.go`
- Modify: `backend/internal/lease/service_test.go`

O service ganha dependência do `ReadjustmentRepository` e passa a expor `Readjust`. O `NewService` muda de assinatura.

- [ ] **Step 1: Estender mock no service_test.go**

Adicionar no início de `service_test.go`:
```go
type mockReadjustmentRepo struct {
	items []lease.Readjustment
}

func newMockReadjustmentRepo() *mockReadjustmentRepo {
	return &mockReadjustmentRepo{}
}

func (m *mockReadjustmentRepo) Create(_ context.Context, in *lease.Readjustment) (*lease.Readjustment, error) {
	in.ID = uuid.New()
	in.CreatedAt = time.Now()
	m.items = append(m.items, *in)
	out := *in
	return &out, nil
}

func (m *mockReadjustmentRepo) ListByLease(_ context.Context, leaseID, ownerID uuid.UUID) ([]lease.Readjustment, error) {
	var out []lease.Readjustment
	for _, r := range m.items {
		if r.LeaseID == leaseID && r.OwnerID == ownerID {
			out = append(out, r)
		}
	}
	return out, nil
}
```

Atualizar todas as chamadas `lease.NewService(mock)` para `lease.NewService(mock, newMockReadjustmentRepo())`.

- [ ] **Step 2: Escrever testes completos de Readjust**

```go
func TestService_Readjust_AplicaERegistra(t *testing.T) {
	leaseMock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	svc := lease.NewService(leaseMock, readjMock)
	ownerID, leaseID := uuid.New(), uuid.New()
	leaseMock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OwnerID: ownerID, Status: "ACTIVE", RentAmount: 2000, IsActive: true,
	}

	out, err := svc.Readjust(context.Background(), leaseID, ownerID, lease.ReadjustInput{
		Percentage: 0.0523, AppliedAt: time.Now(),
	})
	require.NoError(t, err)
	assert.InDelta(t, 2104.60, out.Lease.RentAmount, 0.01)
	assert.InDelta(t, 2104.60, out.Readjustment.NewAmount, 0.01)
	assert.InDelta(t, 2000.00, out.Readjustment.OldAmount, 0.01)
	assert.Len(t, readjMock.items, 1)
}

func TestService_Readjust_LeaseEnded(t *testing.T) {
	leaseMock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	svc := lease.NewService(leaseMock, readjMock)
	ownerID, leaseID := uuid.New(), uuid.New()
	leaseMock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OwnerID: ownerID, Status: "ENDED", RentAmount: 2000, IsActive: true,
	}

	_, err := svc.Readjust(context.Background(), leaseID, ownerID, lease.ReadjustInput{
		Percentage: 0.05, AppliedAt: time.Now(),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not active")
}

func TestService_Readjust_PercentagemForaRange(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	for _, p := range []float64{0, -0.05, 1.01, 2.0} {
		_, err := svc.Readjust(context.Background(), uuid.New(), uuid.New(), lease.ReadjustInput{
			Percentage: p, AppliedAt: time.Now(),
		})
		require.Errorf(t, err, "esperado erro para %v", p)
	}
}
```

Para o mock de lease, acrescente um método `UpdateRent(id, owner, amount)` ou amplie o que já existe (ex: `Update`). Use o método disponível; caso nenhum sirva limpo, adicione no `Repository`:

```go
// lease/model.go — adicionar à interface Repository
UpdateRentAmount(ctx context.Context, id, ownerID uuid.UUID, amount float64) (*Lease, error)
```

(Se preferir reaproveitar `Update`, o service leria o lease, montaria `UpdateLeaseInput` com mesmos campos e trocaria só `rent_amount`. A opção nova explícita é mais limpa.)

- [ ] **Step 3: Rodar — FAIL**

```bash
cd backend && go test ./internal/lease/ -run Readjust
```

- [ ] **Step 4: Implementar**

Em `backend/internal/lease/model.go`, adicionar à interface `Repository`:
```go
UpdateRentAmount(ctx context.Context, id, ownerID uuid.UUID, amount float64) (*Lease, error)
```

Em `backend/internal/lease/repository.go`:
```go
func (r *pgRepository) UpdateRentAmount(ctx context.Context, id, ownerID uuid.UUID, amount float64) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET rent_amount=$1, updated_at=NOW()
		 WHERE id=$2 AND owner_id=$3 AND is_active=true
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount,
		           late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year,
		           status, is_active, created_at, updated_at`,
		amount, id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount,
		&l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: update rent: %w", err)
	}
	return &l, nil
}
```

Também adicione ao mock:
```go
func (m *mockLeaseRepo) UpdateRentAmount(_ context.Context, id, ownerID uuid.UUID, amount float64) (*lease.Lease, error) {
	l, ok := m.leases[id]
	if !ok || l.OwnerID != ownerID { return nil, errors.New("not found") }
	l.RentAmount = amount
	return l, nil
}
```

Em `backend/internal/lease/service.go` — reescrever struct e construtor:
```go
type Service struct {
	repo      Repository
	readjRepo ReadjustmentRepository
}

func NewService(repo Repository, readjRepo ReadjustmentRepository) *Service {
	return &Service{repo: repo, readjRepo: readjRepo}
}

type ReadjustOutput struct {
	Lease        *Lease        `json:"lease"`
	Readjustment *Readjustment `json:"readjustment"`
}

// Reajuste manual. Lei 8.245/91 — reajuste é contratual; o sistema só persiste o que o usuário informa.
func (s *Service) Readjust(ctx context.Context, id, ownerID uuid.UUID, in ReadjustInput) (*ReadjustOutput, error) {
	if in.Percentage <= 0 || in.Percentage > 1 {
		return nil, fmt.Errorf("lease.svc: percentage deve estar em (0, 1]")
	}
	l, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: %w", err)
	}
	if l.Status != "ACTIVE" {
		return nil, fmt.Errorf("lease.svc: lease not active")
	}
	oldAmount := l.RentAmount
	newAmount := round2(oldAmount * (1 + in.Percentage))

	updated, err := s.repo.UpdateRentAmount(ctx, id, ownerID, newAmount)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: readjust update: %w", err)
	}
	r, err := s.readjRepo.Create(ctx, &Readjustment{
		LeaseID: id, OwnerID: ownerID, AppliedAt: in.AppliedAt,
		OldAmount: oldAmount, NewAmount: newAmount, Percentage: in.Percentage,
		IndexName: in.IndexName, Notes: in.Notes,
	})
	if err != nil {
		return nil, fmt.Errorf("lease.svc: readjust persist: %w", err)
	}
	return &ReadjustOutput{Lease: updated, Readjustment: r}, nil
}

func (s *Service) ListReadjustments(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Readjustment, error) {
	return s.readjRepo.ListByLease(ctx, leaseID, ownerID)
}

func round2(x float64) float64 { return math.Round(x*100) / 100 }
```

(Precisa `import "math"`.)

- [ ] **Step 5: Atualizar composição em main.go temporariamente**

Apenas para compilar: em `backend/cmd/api/main.go` linha 73-75, troque por:
```go
leaseRepo := lease.NewRepository(database)
leaseReadjRepo := lease.NewReadjustmentRepository(database)
leaseSvc := lease.NewService(leaseRepo, leaseReadjRepo)
leaseHandler := lease.NewHandler(leaseSvc)
```

- [ ] **Step 6: Rodar testes e build**

```bash
cd backend && go build ./... && go test ./internal/lease/...
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd backend && git add internal/lease/ cmd/api/main.go
git commit -m "feat(lease): Readjust — validação, cálculo, persistência transacional"
```

---

### Task 13: Lease handler — /readjust + /readjustments

**Files:**
- Modify: `backend/internal/lease/handler.go`
- Modify: `backend/internal/lease/handler_test.go`

- [ ] **Step 1: Escrever teste de handler**

```go
func TestHandler_Readjust_Sucesso(t *testing.T) {
	leaseMock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	ownerID, leaseID := uuid.New(), uuid.New()
	leaseMock.leases[leaseID] = &lease.Lease{ID: leaseID, OwnerID: ownerID, Status: "ACTIVE", RentAmount: 2000, IsActive: true}
	h := lease.NewHandler(lease.NewService(leaseMock, readjMock))

	body := `{"percentage":0.0523,"applied_at":"2026-04-01T00:00:00Z","index_name":"IGPM"}`
	req := httptest.NewRequest("POST", "/api/v1/leases/"+leaseID.String()+"/readjust", strings.NewReader(body))
	req = req.WithContext(auth.WithOwnerID(req.Context(), ownerID))
	req = withURLParam(req, "id", leaseID.String())
	w := httptest.NewRecorder()

	h.Readjust(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandler_Readjust_PercentagemInválida(t *testing.T) {
	leaseMock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	ownerID, leaseID := uuid.New(), uuid.New()
	leaseMock.leases[leaseID] = &lease.Lease{ID: leaseID, OwnerID: ownerID, Status: "ACTIVE", RentAmount: 2000, IsActive: true}
	h := lease.NewHandler(lease.NewService(leaseMock, readjMock))

	body := `{"percentage":0,"applied_at":"2026-04-01T00:00:00Z"}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	req = req.WithContext(auth.WithOwnerID(req.Context(), ownerID))
	req = withURLParam(req, "id", leaseID.String())
	w := httptest.NewRecorder()

	h.Readjust(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "INVALID_PERCENTAGE")
}
```

O helper `withURLParam` existe nos handler_tests do projeto; reaproveite o pattern (deve haver em `lease/handler_test.go` ou `payment/handler_test.go`).

- [ ] **Step 2: Rodar — FAIL**

```bash
cd backend && go test ./internal/lease/ -run Handler_Readjust
```

- [ ] **Step 3: Implementar handler.go**

Adicionar em `backend/internal/lease/handler.go`:

```go
// @Summary Aplica reajuste manual ao aluguel
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body ReadjustInput true "Dados do reajuste"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /leases/{id}/readjust [post]
func (h *Handler) Readjust(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in ReadjustInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	out, err := h.svc.Readjust(r.Context(), id, ownerID, in)
	if err != nil {
		switch {
		case strings.Contains(err.Error(), "percentage"):
			httputil.Err(w, http.StatusBadRequest, "INVALID_PERCENTAGE", err.Error())
		case strings.Contains(err.Error(), "not active"):
			httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", err.Error())
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
		default:
			httputil.Err(w, http.StatusInternalServerError, "READJUST_FAILED", err.Error())
		}
		return
	}
	httputil.OK(w, out)
}

// @Summary Lista reajustes de um contrato
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id}/readjustments [get]
func (h *Handler) ListReadjustments(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	list, err := h.svc.ListReadjustments(r.Context(), id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Readjustment{}
	}
	httputil.OK(w, list)
}
```

Adicionar imports `errors`, `strings`, `apierr`.

Registrar em `Register`:
```go
r.With(authMW).Post("/api/v1/leases/{id}/readjust", h.Readjust)
r.With(authMW).Get("/api/v1/leases/{id}/readjustments", h.ListReadjustments)
```

- [ ] **Step 4: Rodar — PASS**

```bash
cd backend && go test ./internal/lease/...
```

- [ ] **Step 5: Regenerar swagger + atualizar CLAUDE.md**

```bash
cd backend && swag init -g cmd/api/main.go -o docs
```

`backend/internal/lease/CLAUDE.md` — adicionar à tabela de rotas:
| POST | /api/v1/leases/{id}/readjust | aplica reajuste manual versionado |
| GET | /api/v1/leases/{id}/readjustments | histórico de reajustes |

E adicionar gotcha: `Readjust exige percentage ∈ (0, 1] e lease ACTIVE. Não retroage sobre payments já gerados.`

- [ ] **Step 6: Commit**

```bash
cd backend && git add internal/lease/ docs/
git commit -m "feat(lease): /readjust and /readjustments endpoints"
```

---


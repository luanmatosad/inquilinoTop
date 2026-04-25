# Backend API Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o backend Go com os domínios `lease`, `payment` e `expense`, corrigir o endpoint `GET /properties/{id}/units` que está faltando, e adicionar Swagger UI em `/swagger/*`.

**Architecture:** Cada domínio segue o padrão estabelecido: `model.go` (tipos + interface Repository) → `repository.go` (SQL via pgx) → `repository_test.go` (integração contra DB de teste na porta 5433) → `service.go` (regras de negócio) → `handler.go` (HTTP chi). Swagger é gerado via `swaggo/swag` com anotações nos handlers.

**Tech Stack:** Go 1.25, chi/v5, pgx/v5, golang-migrate/migrate, swaggo/swag v1.16, http-swagger, testify, PostgreSQL 16

---

## File Map

**Criar:**
- `backend/migrations/000006_create_leases.up.sql`
- `backend/migrations/000006_create_leases.down.sql`
- `backend/migrations/000007_create_payments.up.sql`
- `backend/migrations/000007_create_payments.down.sql`
- `backend/migrations/000008_create_expenses.up.sql`
- `backend/migrations/000008_create_expenses.down.sql`
- `backend/internal/lease/model.go`
- `backend/internal/lease/repository.go`
- `backend/internal/lease/repository_test.go`
- `backend/internal/lease/service.go`
- `backend/internal/lease/handler.go`
- `backend/internal/payment/model.go`
- `backend/internal/payment/repository.go`
- `backend/internal/payment/repository_test.go`
- `backend/internal/payment/service.go`
- `backend/internal/payment/handler.go`
- `backend/internal/expense/model.go`
- `backend/internal/expense/repository.go`
- `backend/internal/expense/repository_test.go`
- `backend/internal/expense/service.go`
- `backend/internal/expense/handler.go`

**Modificar:**
- `backend/internal/property/handler.go` — adicionar `listUnits` endpoint
- `backend/cmd/api/main.go` — registrar novos handlers + Swagger
- `backend/go.mod` / `go.sum` — adicionar swaggo

---

## Task 1: Corrigir endpoint listUnits no property handler

**Files:**
- Modify: `backend/internal/property/handler.go`

O `Register` já tem `POST /properties/{id}/units` mas não tem `GET /properties/{id}/units`. O método `ListUnits` já existe no service e repository.

- [ ] **Step 1: Adicionar rota e handler em `backend/internal/property/handler.go`**

No método `Register`, após a linha `r.With(authMW).Post("/api/v1/properties/{id}/units", h.createUnit)`, adicionar:

```go
r.With(authMW).Get("/api/v1/properties/{id}/units", h.listUnits)
```

Adicionar o método handler ao final do arquivo:

```go
func (h *Handler) listUnits(w http.ResponseWriter, r *http.Request) {
	propertyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	list, err := h.svc.ListUnits(propertyID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Unit{}
	}
	httputil.OK(w, list)
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && go build ./...
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/property/handler.go
git commit -m "feat(property): add GET /properties/{id}/units endpoint"
```

---

## Task 2: Migrations de lease

**Files:**
- Create: `backend/migrations/000006_create_leases.up.sql`
- Create: `backend/migrations/000006_create_leases.down.sql`

- [ ] **Step 1: Criar `backend/migrations/000006_create_leases.up.sql`**

```sql
CREATE TABLE leases (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id        UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    start_date     DATE NOT NULL,
    end_date       DATE,
    rent_amount    FLOAT8 NOT NULL,
    deposit_amount FLOAT8,
    status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELED')),
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leases_owner_id  ON leases(owner_id);
CREATE INDEX idx_leases_unit_id   ON leases(unit_id);
CREATE INDEX idx_leases_tenant_id ON leases(tenant_id);
```

- [ ] **Step 2: Criar `backend/migrations/000006_create_leases.down.sql`**

```sql
DROP TABLE IF EXISTS leases;
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000006_create_leases.up.sql backend/migrations/000006_create_leases.down.sql
git commit -m "feat(lease): add lease migration"
```

---

## Task 3: Lease model.go

**Files:**
- Create: `backend/internal/lease/model.go`

- [ ] **Step 1: Criar `backend/internal/lease/model.go`**

```go
package lease

import (
	"time"

	"github.com/google/uuid"
)

type Lease struct {
	ID            uuid.UUID  `json:"id"`
	OwnerID       uuid.UUID  `json:"owner_id"`
	UnitID        uuid.UUID  `json:"unit_id"`
	TenantID      uuid.UUID  `json:"tenant_id"`
	StartDate     time.Time  `json:"start_date"`
	EndDate       *time.Time `json:"end_date,omitempty"`
	RentAmount    float64    `json:"rent_amount"`
	DepositAmount *float64   `json:"deposit_amount,omitempty"`
	Status        string     `json:"status"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type CreateLeaseInput struct {
	UnitID        uuid.UUID  `json:"unit_id"`
	TenantID      uuid.UUID  `json:"tenant_id"`
	StartDate     time.Time  `json:"start_date"`
	EndDate       *time.Time `json:"end_date,omitempty"`
	RentAmount    float64    `json:"rent_amount"`
	DepositAmount *float64   `json:"deposit_amount,omitempty"`
}

type UpdateLeaseInput struct {
	EndDate       *time.Time `json:"end_date,omitempty"`
	RentAmount    float64    `json:"rent_amount"`
	DepositAmount *float64   `json:"deposit_amount,omitempty"`
	Status        string     `json:"status"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error)
	GetByID(id, ownerID uuid.UUID) (*Lease, error)
	List(ownerID uuid.UUID) ([]Lease, error)
	Update(id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error)
	Delete(id, ownerID uuid.UUID) error
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && go build ./...
```

---

## Task 4: Lease repository_test.go (testes de integração)

**Files:**
- Create: `backend/internal/lease/repository_test.go`

- [ ] **Step 1: Criar `backend/internal/lease/repository_test.go`**

```go
package lease_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users CASCADE")
		d.Close()
	})
	return d
}

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-lease@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedProperty(t *testing.T, database *db.DB, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio Teste') RETURNING id`,
		ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedUnit(t *testing.T, database *db.DB, propertyID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 101') RETURNING id`,
		propertyID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedTenant(t *testing.T, database *db.DB, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, name) VALUES ($1, 'Inquilino Teste') RETURNING id`,
		ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestLeaseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	propertyID := seedProperty(t, database, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, ownerID)
	repo := lease.NewRepository(database)

	l, err := repo.Create(ownerID, lease.CreateLeaseInput{
		UnitID:     unitID,
		TenantID:   tenantID,
		StartDate:  time.Now(),
		RentAmount: 1500.00,
	})
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", l.Status)
	assert.Equal(t, 1500.00, l.RentAmount)

	list, err := repo.List(ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestLeaseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	propertyID := seedProperty(t, database, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})
	err := repo.Delete(l.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.List(ownerID)
	assert.Len(t, list, 0)
}

func TestLeaseRepository_Update(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	propertyID := seedProperty(t, database, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})

	updated, err := repo.Update(l.ID, ownerID, lease.UpdateLeaseInput{
		RentAmount: 1200,
		Status:     "ENDED",
	})
	require.NoError(t, err)
	assert.Equal(t, 1200.00, updated.RentAmount)
	assert.Equal(t, "ENDED", updated.Status)
}
```

- [ ] **Step 2: Rodar teste para confirmar que falha (repo não existe ainda)**

```bash
cd backend && go test ./internal/lease/... -v -run TestLeaseRepository
```

Esperado: erro de compilação — `lease.NewRepository` não definido.

---

## Task 5: Lease repository.go (implementação)

**Files:**
- Create: `backend/internal/lease/repository.go`

- [ ] **Step 1: Criar `backend/internal/lease/repository.go`**

```go
package lease

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO leases (owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
		ownerID, in.UnitID, in.TenantID, in.StartDate, in.EndDate, in.RentAmount, in.DepositAmount,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: create: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at
		 FROM leases WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: get by id: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) List(ownerID uuid.UUID) ([]Lease, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at
		 FROM leases WHERE owner_id=$1 AND is_active=true ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Lease
	for rows.Next() {
		var l Lease
		rows.Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
		list = append(list, l)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE leases SET end_date=$1, rent_amount=$2, deposit_amount=$3, status=$4, updated_at=NOW()
		 WHERE id=$5 AND owner_id=$6 AND is_active=true
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
		in.EndDate, in.RentAmount, in.DepositAmount, in.Status, id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: update: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) Delete(id, ownerID uuid.UUID) error {
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE leases SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	)
	return err
}
```

- [ ] **Step 2: Rodar testes para confirmar que passam**

```bash
cd backend && go test ./internal/lease/... -v -run TestLeaseRepository
```

Esperado: todos os testes PASS. (O test DB na porta 5433 deve estar rodando via `docker compose up postgres_test`)

---

## Task 6: Lease service.go + handler.go

**Files:**
- Create: `backend/internal/lease/service.go`
- Create: `backend/internal/lease/handler.go`

- [ ] **Step 1: Criar `backend/internal/lease/service.go`**

```go
package lease

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	if in.UnitID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: unit_id é obrigatório")
	}
	if in.TenantID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: tenant_id é obrigatório")
	}
	if in.RentAmount <= 0 {
		return nil, fmt.Errorf("lease.svc: rent_amount deve ser positivo")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Lease, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) List(ownerID uuid.UUID) ([]Lease, error) {
	return s.repo.List(ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	if in.Status != "ACTIVE" && in.Status != "ENDED" && in.Status != "CANCELED" {
		return nil, fmt.Errorf("lease.svc: status inválido")
	}
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) Delete(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}
```

- [ ] **Step 2: Criar `backend/internal/lease/handler.go`**

```go
package lease

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/leases", h.list)
	r.With(authMW).Post("/api/v1/leases", h.create)
	r.With(authMW).Get("/api/v1/leases/{id}", h.get)
	r.With(authMW).Put("/api/v1/leases/{id}", h.update)
	r.With(authMW).Delete("/api/v1/leases/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	list, err := h.svc.List(ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Lease{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	var in CreateLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	l, err := h.svc.Create(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, l)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	l, err := h.svc.Get(id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
		return
	}
	httputil.OK(w, l)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in UpdateLeaseInput
	json.NewDecoder(r.Body).Decode(&in)
	l, err := h.svc.Update(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.Delete(id, ownerID); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd backend && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/lease/
git commit -m "feat(lease): add lease domain (model, repo, service, handler)"
```

---

## Task 7: Migrations de payment

**Files:**
- Create: `backend/migrations/000007_create_payments.up.sql`
- Create: `backend/migrations/000007_create_payments.down.sql`

- [ ] **Step 1: Criar `backend/migrations/000007_create_payments.up.sql`**

```sql
CREATE TABLE payments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lease_id   UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
    due_date   DATE NOT NULL,
    paid_date  DATE,
    amount     FLOAT8 NOT NULL,
    status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'LATE')),
    type       TEXT NOT NULL DEFAULT 'RENT' CHECK (type IN ('RENT', 'DEPOSIT', 'EXPENSE', 'OTHER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_lease_id ON payments(lease_id);
CREATE INDEX idx_payments_owner_id ON payments(owner_id);
```

- [ ] **Step 2: Criar `backend/migrations/000007_create_payments.down.sql`**

```sql
DROP TABLE IF EXISTS payments;
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000007_create_payments.up.sql backend/migrations/000007_create_payments.down.sql
git commit -m "feat(payment): add payment migration"
```

---

## Task 8: Payment model.go

**Files:**
- Create: `backend/internal/payment/model.go`

- [ ] **Step 1: Criar `backend/internal/payment/model.go`**

```go
package payment

import (
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID        uuid.UUID  `json:"id"`
	OwnerID   uuid.UUID  `json:"owner_id"`
	LeaseID   uuid.UUID  `json:"lease_id"`
	DueDate   time.Time  `json:"due_date"`
	PaidDate  *time.Time `json:"paid_date,omitempty"`
	Amount    float64    `json:"amount"`
	Status    string     `json:"status"`
	Type      string     `json:"type"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CreatePaymentInput struct {
	LeaseID uuid.UUID `json:"lease_id"`
	DueDate time.Time `json:"due_date"`
	Amount  float64   `json:"amount"`
	Type    string    `json:"type"`
}

type UpdatePaymentInput struct {
	PaidDate *time.Time `json:"paid_date,omitempty"`
	Status   string     `json:"status"`
	Amount   float64    `json:"amount"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	GetByID(id, ownerID uuid.UUID) (*Payment, error)
	ListByLease(leaseID, ownerID uuid.UUID) ([]Payment, error)
	Update(id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
}
```

---

## Task 9: Payment repository_test.go

**Files:**
- Create: `backend/internal/payment/repository_test.go`

- [ ] **Step 1: Criar `backend/internal/payment/repository_test.go`**

```go
package payment_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users CASCADE")
		d.Close()
	})
	return d
}

func seedLease(t *testing.T, database *db.DB) (ownerID uuid.UUID, leaseID uuid.UUID) {
	t.Helper()
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-payment@test.com", "hash",
	).Scan(&ownerID)
	require.NoError(t, err)

	var propertyID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio') RETURNING id`,
		ownerID,
	).Scan(&propertyID)
	require.NoError(t, err)

	var unitID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 1') RETURNING id`,
		propertyID,
	).Scan(&unitID)
	require.NoError(t, err)

	var tenantID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, name) VALUES ($1, 'Inquilino') RETURNING id`,
		ownerID,
	).Scan(&tenantID)
	require.NoError(t, err)

	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO leases (owner_id, unit_id, tenant_id, start_date, rent_amount)
		 VALUES ($1, $2, $3, NOW(), 1000) RETURNING id`,
		ownerID, unitID, tenantID,
	).Scan(&leaseID)
	require.NoError(t, err)

	return ownerID, leaseID
}

func TestPaymentRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)

	p, err := repo.Create(ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID,
		DueDate: time.Now(),
		Amount:  1000.00,
		Type:    "RENT",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p.Status)
	assert.Equal(t, "RENT", p.Type)

	list, err := repo.ListByLease(leaseID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestPaymentRepository_Update_MarkAsPaid(t *testing.T) {
	database := testDB(t)
	ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)

	p, _ := repo.Create(ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), Amount: 1000, Type: "RENT",
	})

	now := time.Now()
	updated, err := repo.Update(p.ID, ownerID, payment.UpdatePaymentInput{
		PaidDate: &now,
		Status:   "PAID",
		Amount:   1000,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", updated.Status)
	assert.NotNil(t, updated.PaidDate)
}
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
cd backend && go test ./internal/payment/... -v -run TestPaymentRepository
```

Esperado: erro de compilação — `payment.NewRepository` não definido.

---

## Task 10: Payment repository.go

**Files:**
- Create: `backend/internal/payment/repository.go`

- [ ] **Step 1: Criar `backend/internal/payment/repository.go`**

```go
package payment

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	var p Payment
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO payments (owner_id, lease_id, due_date, amount, type)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at`,
		ownerID, in.LeaseID, in.DueDate, in.Amount, in.Type,
	).Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Payment, error) {
	var p Payment
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at
		 FROM payments WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListByLease(leaseID, ownerID uuid.UUID) ([]Payment, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at
		 FROM payments WHERE lease_id=$1 AND owner_id=$2 ORDER BY due_date`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by lease: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		rows.Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
		list = append(list, p)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	var p Payment
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE payments SET paid_date=$1, status=$2, amount=$3, updated_at=NOW()
		 WHERE id=$4 AND owner_id=$5
		 RETURNING id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at`,
		in.PaidDate, in.Status, in.Amount, id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: update: %w", err)
	}
	return &p, nil
}
```

- [ ] **Step 2: Rodar testes para confirmar que passam**

```bash
cd backend && go test ./internal/payment/... -v -run TestPaymentRepository
```

Esperado: todos os testes PASS.

---

## Task 11: Payment service.go + handler.go

**Files:**
- Create: `backend/internal/payment/service.go`
- Create: `backend/internal/payment/handler.go`

- [ ] **Step 1: Criar `backend/internal/payment/service.go`**

```go
package payment

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	if in.LeaseID == uuid.Nil {
		return nil, fmt.Errorf("payment.svc: lease_id é obrigatório")
	}
	if in.Amount <= 0 {
		return nil, fmt.Errorf("payment.svc: amount deve ser positivo")
	}
	validTypes := map[string]bool{"RENT": true, "DEPOSIT": true, "EXPENSE": true, "OTHER": true}
	if !validTypes[in.Type] {
		return nil, fmt.Errorf("payment.svc: type inválido")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Payment, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) ListByLease(leaseID, ownerID uuid.UUID) ([]Payment, error) {
	return s.repo.ListByLease(leaseID, ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	validStatuses := map[string]bool{"PENDING": true, "PAID": true, "LATE": true}
	if !validStatuses[in.Status] {
		return nil, fmt.Errorf("payment.svc: status inválido")
	}
	return s.repo.Update(id, ownerID, in)
}
```

- [ ] **Step 2: Criar `backend/internal/payment/handler.go`**

```go
package payment

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/leases/{leaseId}/payments", h.listByLease)
	r.With(authMW).Post("/api/v1/leases/{leaseId}/payments", h.create)
	r.With(authMW).Put("/api/v1/payments/{id}", h.update)
}

func (h *Handler) listByLease(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	list, err := h.svc.ListByLease(leaseID, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Payment{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	var in CreatePaymentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	in.LeaseID = leaseID
	p, err := h.svc.Create(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, p)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in UpdatePaymentInput
	json.NewDecoder(r.Body).Decode(&in)
	p, err := h.svc.Update(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd backend && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/payment/
git commit -m "feat(payment): add payment domain (model, repo, service, handler)"
```

---

## Task 12: Migrations de expense

**Files:**
- Create: `backend/migrations/000008_create_expenses.up.sql`
- Create: `backend/migrations/000008_create_expenses.down.sql`

- [ ] **Step 1: Criar `backend/migrations/000008_create_expenses.up.sql`**

```sql
CREATE TABLE expenses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id     UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount      FLOAT8 NOT NULL,
    due_date    DATE NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('ELECTRICITY', 'WATER', 'CONDO', 'TAX', 'MAINTENANCE', 'OTHER')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_unit_id  ON expenses(unit_id);
CREATE INDEX idx_expenses_owner_id ON expenses(owner_id);
```

- [ ] **Step 2: Criar `backend/migrations/000008_create_expenses.down.sql`**

```sql
DROP TABLE IF EXISTS expenses;
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000008_create_expenses.up.sql backend/migrations/000008_create_expenses.down.sql
git commit -m "feat(expense): add expense migration"
```

---

## Task 13: Expense model.go

**Files:**
- Create: `backend/internal/expense/model.go`

- [ ] **Step 1: Criar `backend/internal/expense/model.go`**

```go
package expense

import (
	"time"

	"github.com/google/uuid"
)

type Expense struct {
	ID          uuid.UUID `json:"id"`
	OwnerID     uuid.UUID `json:"owner_id"`
	UnitID      uuid.UUID `json:"unit_id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	DueDate     time.Time `json:"due_date"`
	Category    string    `json:"category"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateExpenseInput struct {
	UnitID      uuid.UUID `json:"unit_id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	DueDate     time.Time `json:"due_date"`
	Category    string    `json:"category"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	GetByID(id, ownerID uuid.UUID) (*Expense, error)
	ListByUnit(unitID, ownerID uuid.UUID) ([]Expense, error)
	Update(id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	Delete(id, ownerID uuid.UUID) error
}
```

---

## Task 14: Expense repository_test.go

**Files:**
- Create: `backend/internal/expense/repository_test.go`

- [ ] **Step 1: Criar `backend/internal/expense/repository_test.go`**

```go
package expense_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users CASCADE")
		d.Close()
	})
	return d
}

func seedUnit(t *testing.T, database *db.DB) (ownerID uuid.UUID, unitID uuid.UUID) {
	t.Helper()
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-expense@test.com", "hash",
	).Scan(&ownerID)
	require.NoError(t, err)

	var propertyID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio') RETURNING id`,
		ownerID,
	).Scan(&propertyID)
	require.NoError(t, err)

	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 1') RETURNING id`,
		propertyID,
	).Scan(&unitID)
	require.NoError(t, err)

	return ownerID, unitID
}

func TestExpenseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)

	e, err := repo.Create(ownerID, expense.CreateExpenseInput{
		UnitID:      unitID,
		Description: "Conta de água",
		Amount:      150.00,
		DueDate:     time.Now(),
		Category:    "WATER",
	})
	require.NoError(t, err)
	assert.Equal(t, "WATER", e.Category)
	assert.Equal(t, 150.00, e.Amount)

	list, err := repo.ListByUnit(unitID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestExpenseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)

	e, _ := repo.Create(ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Energia", Amount: 200, DueDate: time.Now(), Category: "ELECTRICITY",
	})
	err := repo.Delete(e.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.ListByUnit(unitID, ownerID)
	assert.Len(t, list, 0)
}
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

```bash
cd backend && go test ./internal/expense/... -v -run TestExpenseRepository
```

Esperado: erro de compilação — `expense.NewRepository` não definido.

---

## Task 15: Expense repository.go

**Files:**
- Create: `backend/internal/expense/repository.go`

- [ ] **Step 1: Criar `backend/internal/expense/repository.go`**

```go
package expense

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO expenses (owner_id, unit_id, description, amount, due_date, category)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, owner_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at`,
		ownerID, in.UnitID, in.Description, in.Amount, in.DueDate, in.Category,
	).Scan(&e.ID, &e.OwnerID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: create: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at
		 FROM expenses WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&e.ID, &e.OwnerID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: get by id: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) ListByUnit(unitID, ownerID uuid.UUID) ([]Expense, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at
		 FROM expenses WHERE unit_id=$1 AND owner_id=$2 AND is_active=true ORDER BY due_date DESC`,
		unitID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: list by unit: %w", err)
	}
	defer rows.Close()
	var list []Expense
	for rows.Next() {
		var e Expense
		rows.Scan(&e.ID, &e.OwnerID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
		list = append(list, e)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE expenses SET description=$1, amount=$2, due_date=$3, category=$4, updated_at=NOW()
		 WHERE id=$5 AND owner_id=$6 AND is_active=true
		 RETURNING id, owner_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at`,
		in.Description, in.Amount, in.DueDate, in.Category, id, ownerID,
	).Scan(&e.ID, &e.OwnerID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: update: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) Delete(id, ownerID uuid.UUID) error {
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE expenses SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	)
	return err
}
```

- [ ] **Step 2: Rodar testes para confirmar que passam**

```bash
cd backend && go test ./internal/expense/... -v -run TestExpenseRepository
```

Esperado: todos os testes PASS.

---

## Task 16: Expense service.go + handler.go

**Files:**
- Create: `backend/internal/expense/service.go`
- Create: `backend/internal/expense/handler.go`

- [ ] **Step 1: Criar `backend/internal/expense/service.go`**

```go
package expense

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	if in.Description == "" {
		return nil, fmt.Errorf("expense.svc: description é obrigatório")
	}
	if in.Amount <= 0 {
		return nil, fmt.Errorf("expense.svc: amount deve ser positivo")
	}
	validCategories := map[string]bool{
		"ELECTRICITY": true, "WATER": true, "CONDO": true,
		"TAX": true, "MAINTENANCE": true, "OTHER": true,
	}
	if !validCategories[in.Category] {
		return nil, fmt.Errorf("expense.svc: category inválida")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Expense, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) ListByUnit(unitID, ownerID uuid.UUID) ([]Expense, error) {
	return s.repo.ListByUnit(unitID, ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) Delete(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}
```

- [ ] **Step 2: Criar `backend/internal/expense/handler.go`**

```go
package expense

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/units/{unitId}/expenses", h.listByUnit)
	r.With(authMW).Post("/api/v1/units/{unitId}/expenses", h.create)
	r.With(authMW).Put("/api/v1/expenses/{id}", h.update)
	r.With(authMW).Delete("/api/v1/expenses/{id}", h.delete)
}

func (h *Handler) listByUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	unitID, err := uuid.Parse(chi.URLParam(r, "unitId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "unitId inválido")
		return
	}
	list, err := h.svc.ListByUnit(unitID, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Expense{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	unitID, err := uuid.Parse(chi.URLParam(r, "unitId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "unitId inválido")
		return
	}
	var in CreateExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	in.UnitID = unitID
	e, err := h.svc.Create(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, e)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateExpenseInput
	json.NewDecoder(r.Body).Decode(&in)
	e, err := h.svc.Update(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, e)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.Delete(id, ownerID); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd backend && go build ./...
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/expense/
git commit -m "feat(expense): add expense domain (model, repo, service, handler)"
```

---

## Task 17: Registrar novos handlers em main.go

**Files:**
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Adicionar imports e registros em `backend/cmd/api/main.go`**

Adicionar imports (após os imports existentes de `identity`, `property`, `tenant`):

```go
"github.com/inquilinotop/api/internal/expense"
"github.com/inquilinotop/api/internal/lease"
"github.com/inquilinotop/api/internal/payment"
```

Após `tenantHandler := tenant.NewHandler(tenantSvc)`, adicionar:

```go
leaseRepo := lease.NewRepository(database)
leaseSvc := lease.NewService(leaseRepo)
leaseHandler := lease.NewHandler(leaseSvc)

paymentRepo := payment.NewRepository(database)
paymentSvc := payment.NewService(paymentRepo)
paymentHandler := payment.NewHandler(paymentSvc)

expenseRepo := expense.NewRepository(database)
expenseSvc := expense.NewService(expenseRepo)
expenseHandler := expense.NewHandler(expenseSvc)
```

Após `tenantHandler.Register(r, authMW)`, adicionar:

```go
leaseHandler.Register(r, authMW)
paymentHandler.Register(r, authMW)
expenseHandler.Register(r, authMW)
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && go build ./...
```

Esperado: sem erros.

- [ ] **Step 3: Testar o servidor manualmente**

```bash
cd backend && docker compose up postgres -d && go run ./cmd/api/main.go
```

Em outro terminal:
```bash
curl -s http://localhost:8080/health | jq .
```

Esperado: `{"data":{"status":"ok"},"error":null}`

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/api/main.go
git commit -m "feat: register lease, payment, expense handlers in main"
```

---

## Task 18: Adicionar Swagger

**Files:**
- Modify: `backend/go.mod` / `backend/go.sum`
- Modify: `backend/cmd/api/main.go`
- Modify: `backend/internal/identity/handler.go`
- Modify: `backend/internal/property/handler.go`
- Modify: `backend/internal/tenant/handler.go`
- Modify: `backend/internal/lease/handler.go`
- Modify: `backend/internal/payment/handler.go`
- Modify: `backend/internal/expense/handler.go`
- Create: `backend/docs/` (gerado por swag)

- [ ] **Step 1: Instalar dependências swaggo**

```bash
cd backend
go get github.com/swaggo/swag@v1.16.4
go get github.com/swaggo/http-swagger@v1.3.4
go install github.com/swaggo/swag/cmd/swag@v1.16.4
```

- [ ] **Step 2: Adicionar anotação global em `backend/cmd/api/main.go`**

Adicionar antes da função `main()`:

```go
//	@title			InquilinoTop API
//	@version		1.0
//	@description	API de gestão de imóveis para locação
//	@host			localhost:8080
//	@BasePath		/api/v1

//	@securityDefinitions.apikey	BearerAuth
//	@in							header
//	@name						Authorization
//	@description				JWT token no formato: Bearer <token>
```

Adicionar imports:

```go
httpSwagger "github.com/swaggo/http-swagger"
_ "github.com/inquilinotop/api/docs"
```

Após `r.Get("/health", ...)`, adicionar:

```go
r.Get("/swagger/*", httpSwagger.WrapHandler)
```

- [ ] **Step 3: Adicionar anotações em `backend/internal/identity/handler.go`**

Antes de `func (h *Handler) register(...)`:
```go
// @Summary Registrar novo usuário
// @Tags auth
// @Accept json
// @Produce json
// @Param body body credentialsInput true "Email e senha"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /auth/register [post]
```

Antes de `func (h *Handler) login(...)`:
```go
// @Summary Login
// @Tags auth
// @Accept json
// @Produce json
// @Param body body credentialsInput true "Email e senha"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/login [post]
```

Antes de `func (h *Handler) refresh(...)`:
```go
// @Summary Renovar token
// @Tags auth
// @Accept json
// @Produce json
// @Param body body refreshInput true "Refresh token"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/refresh [post]
```

Antes de `func (h *Handler) logout(...)`:
```go
// @Summary Logout
// @Tags auth
// @Accept json
// @Produce json
// @Param body body refreshInput true "Refresh token"
// @Success 200 {object} map[string]interface{}
// @Router /auth/logout [post]
```

- [ ] **Step 4: Adicionar anotações em `backend/internal/property/handler.go`**

Antes de `func (h *Handler) list(...)`:
```go
// @Summary Lista imóveis
// @Tags properties
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /properties [get]
```

Antes de `func (h *Handler) create(...)`:
```go
// @Summary Cria imóvel
// @Tags properties
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreatePropertyInput true "Dados do imóvel"
// @Success 201 {object} map[string]interface{}
// @Router /properties [post]
```

Antes de `func (h *Handler) get(...)`:
```go
// @Summary Busca imóvel por ID
// @Tags properties
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do imóvel"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /properties/{id} [get]
```

Antes de `func (h *Handler) update(...)`:
```go
// @Summary Atualiza imóvel
// @Tags properties
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do imóvel"
// @Param body body CreatePropertyInput true "Dados do imóvel"
// @Success 200 {object} map[string]interface{}
// @Router /properties/{id} [put]
```

Antes de `func (h *Handler) delete(...)`:
```go
// @Summary Remove imóvel (soft-delete)
// @Tags properties
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do imóvel"
// @Success 200 {object} map[string]interface{}
// @Router /properties/{id} [delete]
```

Antes de `func (h *Handler) listUnits(...)`:
```go
// @Summary Lista unidades de um imóvel
// @Tags units
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do imóvel"
// @Success 200 {object} map[string]interface{}
// @Router /properties/{id}/units [get]
```

Antes de `func (h *Handler) createUnit(...)`:
```go
// @Summary Cria unidade em um imóvel
// @Tags units
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do imóvel"
// @Param body body CreateUnitInput true "Dados da unidade"
// @Success 201 {object} map[string]interface{}
// @Router /properties/{id}/units [post]
```

Antes de `func (h *Handler) getUnit(...)`:
```go
// @Summary Busca unidade por ID
// @Tags units
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{id} [get]
```

Antes de `func (h *Handler) updateUnit(...)`:
```go
// @Summary Atualiza unidade
// @Tags units
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID da unidade"
// @Param body body CreateUnitInput true "Dados da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{id} [put]
```

Antes de `func (h *Handler) deleteUnit(...)`:
```go
// @Summary Remove unidade (soft-delete)
// @Tags units
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{id} [delete]
```

- [ ] **Step 5: Adicionar anotações em `backend/internal/tenant/handler.go`**

Antes de `func (h *Handler) list(...)`:
```go
// @Summary Lista inquilinos
// @Tags tenants
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /tenants [get]
```

Antes de `func (h *Handler) create(...)`:
```go
// @Summary Cria inquilino
// @Tags tenants
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateTenantInput true "Dados do inquilino"
// @Success 201 {object} map[string]interface{}
// @Router /tenants [post]
```

Antes de `func (h *Handler) get(...)`:
```go
// @Summary Busca inquilino por ID
// @Tags tenants
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do inquilino"
// @Success 200 {object} map[string]interface{}
// @Router /tenants/{id} [get]
```

Antes de `func (h *Handler) update(...)`:
```go
// @Summary Atualiza inquilino
// @Tags tenants
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do inquilino"
// @Param body body CreateTenantInput true "Dados do inquilino"
// @Success 200 {object} map[string]interface{}
// @Router /tenants/{id} [put]
```

Antes de `func (h *Handler) delete(...)`:
```go
// @Summary Remove inquilino (soft-delete)
// @Tags tenants
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do inquilino"
// @Success 200 {object} map[string]interface{}
// @Router /tenants/{id} [delete]
```

- [ ] **Step 6: Adicionar anotações em `backend/internal/lease/handler.go`**

Antes de `func (h *Handler) list(...)`:
```go
// @Summary Lista contratos
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /leases [get]
```

Antes de `func (h *Handler) create(...)`:
```go
// @Summary Cria contrato
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateLeaseInput true "Dados do contrato"
// @Success 201 {object} map[string]interface{}
// @Router /leases [post]
```

Antes de `func (h *Handler) get(...)`:
```go
// @Summary Busca contrato por ID
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id} [get]
```

Antes de `func (h *Handler) update(...)`:
```go
// @Summary Atualiza contrato
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body UpdateLeaseInput true "Dados do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id} [put]
```

Antes de `func (h *Handler) delete(...)`:
```go
// @Summary Remove contrato (soft-delete)
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id} [delete]
```

- [ ] **Step 7: Adicionar anotações em `backend/internal/payment/handler.go`**

Antes de `func (h *Handler) listByLease(...)`:
```go
// @Summary Lista pagamentos de um contrato
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param leaseId path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{leaseId}/payments [get]
```

Antes de `func (h *Handler) create(...)`:
```go
// @Summary Registra pagamento
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param leaseId path string true "ID do contrato"
// @Param body body CreatePaymentInput true "Dados do pagamento"
// @Success 201 {object} map[string]interface{}
// @Router /leases/{leaseId}/payments [post]
```

Antes de `func (h *Handler) update(...)`:
```go
// @Summary Atualiza pagamento (ex: marcar como pago)
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do pagamento"
// @Param body body UpdatePaymentInput true "Dados do pagamento"
// @Success 200 {object} map[string]interface{}
// @Router /payments/{id} [put]
```

- [ ] **Step 8: Adicionar anotações em `backend/internal/expense/handler.go`**

Antes de `func (h *Handler) listByUnit(...)`:
```go
// @Summary Lista despesas de uma unidade
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{unitId}/expenses [get]
```

Antes de `func (h *Handler) create(...)`:
```go
// @Summary Cria despesa
// @Tags expenses
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Param body body CreateExpenseInput true "Dados da despesa"
// @Success 201 {object} map[string]interface{}
// @Router /units/{unitId}/expenses [post]
```

Antes de `func (h *Handler) update(...)`:
```go
// @Summary Atualiza despesa
// @Tags expenses
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID da despesa"
// @Param body body CreateExpenseInput true "Dados da despesa"
// @Success 200 {object} map[string]interface{}
// @Router /expenses/{id} [put]
```

Antes de `func (h *Handler) delete(...)`:
```go
// @Summary Remove despesa (soft-delete)
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da despesa"
// @Success 200 {object} map[string]interface{}
// @Router /expenses/{id} [delete]
```

- [ ] **Step 9: Gerar docs Swagger**

```bash
cd backend && swag init -g cmd/api/main.go -o docs
```

Esperado: cria `backend/docs/docs.go`, `backend/docs/swagger.json`, `backend/docs/swagger.yaml`.

- [ ] **Step 10: Verificar que compila com os docs gerados**

```bash
cd backend && go build ./...
```

Esperado: sem erros.

- [ ] **Step 11: Testar Swagger UI**

```bash
cd backend && go run ./cmd/api/main.go
```

Abrir no browser: `http://localhost:8080/swagger/index.html`

Esperado: Swagger UI carrega com todos os grupos (auth, properties, units, tenants, leases, payments, expenses).

Testar o fluxo:
1. `POST /auth/register` → cria usuário
2. `POST /auth/login` → copia o `access_token`
3. Clicar em "Authorize" → colar `Bearer <token>`
4. `POST /properties` → criar imóvel
5. `GET /properties` → listar imóveis

- [ ] **Step 12: Commit final**

```bash
git add backend/
git commit -m "feat: add Swagger UI with annotations for all endpoints"
```

---

## Verificação final

- [ ] `docker compose up` sobe tudo sem erros
- [ ] `http://localhost:8080/swagger/index.html` mostra todos os endpoints
- [ ] `http://localhost:8080/health` retorna `{"data":{"status":"ok"}}`
- [ ] Todos os testes passam: `cd backend && go test ./...`

---

## Próximo plano

Após completar este plano, criar o plano de migração do frontend:
`docs/superpowers/plans/2026-04-19-frontend-migration.md`

O frontend deve deixar de usar Supabase e passar a chamar este backend via `src/lib/api/client.ts`.

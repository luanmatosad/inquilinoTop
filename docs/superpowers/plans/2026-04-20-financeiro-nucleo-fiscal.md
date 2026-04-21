# Núcleo Fiscal do Ciclo de Aluguel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o núcleo fiscal do ciclo mensal de aluguel (geração, multa/juros, IRRF, IPTU, reajuste, recibo, relatório anual) em 7 fases sequenciais, TDD em cada tarefa.

**Architecture:** Estende `tenant`, `lease`, `payment` existentes; cria novo módulo `internal/fiscal/`. Dependências: `payment.Service` passa a depender de `lease.Repository`, `tenant.Repository` e `fiscal.IRRFTable`. Composição em `cmd/api/main.go`.

**Tech Stack:** Go 1.25, chi v5, pgx v5, golang-migrate, testify (require/assert), PostgreSQL, FLOAT8 para monetários (consistência com schema existente — tech-debt conhecido).

**Base Spec:** `docs/superpowers/specs/2026-04-20-financeiro-nucleo-fiscal-design.md`.

**Decisão de implementação:** o spec descreve `NUMERIC(14,2)` para monetários, mas o schema atual usa `FLOAT8` em `leases.rent_amount` e `payments.amount`. Por consistência com o projeto, **novas colunas monetárias usam `FLOAT8`** e `math.Round(x*100)/100` garante 2 casas. Rollback para `NUMERIC` fica como tech-debt futuro.

---

## Estrutura de Arquivos

### Criar
```
backend/migrations/000009_add_tenant_person_type.up.sql
backend/migrations/000009_add_tenant_person_type.down.sql
backend/migrations/000010_add_lease_fiscal_fields.up.sql
backend/migrations/000010_add_lease_fiscal_fields.down.sql
backend/migrations/000011_add_payment_breakdown.up.sql
backend/migrations/000011_add_payment_breakdown.down.sql
backend/migrations/000012_create_lease_readjustments.up.sql
backend/migrations/000012_create_lease_readjustments.down.sql
backend/migrations/000013_create_irrf_brackets.up.sql
backend/migrations/000013_create_irrf_brackets.down.sql
backend/internal/lease/readjustment.go            # model + interface separados
backend/internal/lease/readjustment_test.go
backend/internal/fiscal/model.go
backend/internal/fiscal/repository.go
backend/internal/fiscal/repository_test.go
backend/internal/fiscal/service.go
backend/internal/fiscal/service_test.go
backend/internal/fiscal/handler.go
backend/internal/fiscal/handler_test.go
backend/internal/fiscal/irrf.go                   # IRRFTable impl
backend/internal/fiscal/irrf_test.go
backend/internal/fiscal/CLAUDE.md
```

### Modificar
```
backend/internal/tenant/model.go          # add PersonType
backend/internal/tenant/repository.go     # propagate person_type
backend/internal/tenant/service.go        # validate person_type
backend/internal/tenant/service_test.go   # add coverage
backend/internal/tenant/handler_test.go   # add coverage
backend/internal/tenant/repository_test.go
backend/internal/tenant/CLAUDE.md
backend/internal/lease/model.go           # add 5 fiscal fields + Readjust input
backend/internal/lease/repository.go      # propagate fields
backend/internal/lease/service.go         # add Readjust
backend/internal/lease/service_test.go
backend/internal/lease/handler.go         # add /readjust + /readjustments
backend/internal/lease/handler_test.go
backend/internal/lease/repository_test.go
backend/internal/lease/CLAUDE.md
backend/internal/payment/model.go         # rename Amount→GrossAmount + new fields + deps
backend/internal/payment/repository.go    # new columns
backend/internal/payment/service.go       # Enrich + GenerateMonth + MarkPaid
backend/internal/payment/service_test.go
backend/internal/payment/handler.go       # /generate + /receipt
backend/internal/payment/handler_test.go
backend/internal/payment/repository_test.go
backend/internal/payment/CLAUDE.md
backend/cmd/api/main.go                   # wire fiscal module + new deps
backend/CLAUDE.md                         # módulo fiscal
```

---

## Fase 0 — Migrations (SQL puro, sem Go)

### Task 1: Migration 000009 — tenants.person_type

**Files:**
- Create: `backend/migrations/000009_add_tenant_person_type.up.sql`
- Create: `backend/migrations/000009_add_tenant_person_type.down.sql`

- [ ] **Step 1: Criar up migration**

`backend/migrations/000009_add_tenant_person_type.up.sql`:
```sql
ALTER TABLE tenants
  ADD COLUMN person_type TEXT NOT NULL DEFAULT 'PF'
    CHECK (person_type IN ('PF','PJ'));
```

- [ ] **Step 2: Criar down migration**

`backend/migrations/000009_add_tenant_person_type.down.sql`:
```sql
ALTER TABLE tenants DROP COLUMN person_type;
```

- [ ] **Step 3: Rodar up contra DB de teste**

```bash
cd backend && make test-backend-integration 2>&1 | head -30
```
Expected: sem erro em `RunMigrations` na startup dos testes. Se aparecer `migration failed`, corrigir antes de seguir.

- [ ] **Step 4: Commit**

```bash
cd backend && git add migrations/000009_add_tenant_person_type.up.sql migrations/000009_add_tenant_person_type.down.sql
git commit -m "feat(db): add tenants.person_type column (PF|PJ)"
```

---

### Task 2: Migration 000010 — leases fiscal fields

**Files:**
- Create: `backend/migrations/000010_add_lease_fiscal_fields.up.sql`
- Create: `backend/migrations/000010_add_lease_fiscal_fields.down.sql`

- [ ] **Step 1: Criar up migration**

```sql
ALTER TABLE leases
  ADD COLUMN late_fee_percent       FLOAT8  NOT NULL DEFAULT 0,
  ADD COLUMN daily_interest_percent FLOAT8  NOT NULL DEFAULT 0,
  ADD COLUMN iptu_reimbursable      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN annual_iptu_amount     FLOAT8,
  ADD COLUMN iptu_year              INT;
```

- [ ] **Step 2: Criar down migration**

```sql
ALTER TABLE leases
  DROP COLUMN late_fee_percent,
  DROP COLUMN daily_interest_percent,
  DROP COLUMN iptu_reimbursable,
  DROP COLUMN annual_iptu_amount,
  DROP COLUMN iptu_year;
```

- [ ] **Step 3: Rodar e validar**

```bash
cd backend && make test-backend-integration 2>&1 | grep -E "(migration|PASS|FAIL)" | head -20
```
Expected: migrações aplicam limpas.

- [ ] **Step 4: Commit**

```bash
cd backend && git add migrations/000010_add_lease_fiscal_fields.up.sql migrations/000010_add_lease_fiscal_fields.down.sql
git commit -m "feat(db): add fiscal fields to leases"
```

---

### Task 3: Migration 000011 — payments breakdown + unique index

**Files:**
- Create: `backend/migrations/000011_add_payment_breakdown.up.sql`
- Create: `backend/migrations/000011_add_payment_breakdown.down.sql`

- [ ] **Step 1: Criar up migration**

```sql
ALTER TABLE payments RENAME COLUMN amount TO gross_amount;
ALTER TABLE payments
  ADD COLUMN late_fee_amount FLOAT8 NOT NULL DEFAULT 0,
  ADD COLUMN interest_amount FLOAT8 NOT NULL DEFAULT 0,
  ADD COLUMN irrf_amount     FLOAT8 NOT NULL DEFAULT 0,
  ADD COLUMN net_amount      FLOAT8,
  ADD COLUMN competency      CHAR(7),
  ADD COLUMN description     TEXT;

CREATE UNIQUE INDEX ux_payments_lease_competency_type
  ON payments(lease_id, competency, type) WHERE competency IS NOT NULL;
```

- [ ] **Step 2: Criar down migration**

```sql
DROP INDEX IF EXISTS ux_payments_lease_competency_type;
ALTER TABLE payments
  DROP COLUMN late_fee_amount,
  DROP COLUMN interest_amount,
  DROP COLUMN irrf_amount,
  DROP COLUMN net_amount,
  DROP COLUMN competency,
  DROP COLUMN description;
ALTER TABLE payments RENAME COLUMN gross_amount TO amount;
```

- [ ] **Step 3: Rodar e validar**

```bash
cd backend && make test-backend-integration 2>&1 | head -30
```
Expected: **alguns testes existentes de payment vão falhar** porque o código Go ainda referencia `amount`. Isso é OK — será corrigido na Fase 3. Confirme apenas que as migrações aplicam.

- [ ] **Step 4: Commit**

```bash
cd backend && git add migrations/000011_add_payment_breakdown.up.sql migrations/000011_add_payment_breakdown.down.sql
git commit -m "feat(db): rename payments.amount to gross_amount + breakdown fields"
```

---

### Task 4: Migration 000012 — lease_readjustments

**Files:**
- Create: `backend/migrations/000012_create_lease_readjustments.up.sql`
- Create: `backend/migrations/000012_create_lease_readjustments.down.sql`

- [ ] **Step 1: Criar up**

```sql
CREATE TABLE lease_readjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id      UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  applied_at    DATE NOT NULL,
  old_amount    FLOAT8 NOT NULL,
  new_amount    FLOAT8 NOT NULL,
  percentage    FLOAT8 NOT NULL,
  index_name    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_readjustments_lease ON lease_readjustments(lease_id);
CREATE INDEX idx_readjustments_owner ON lease_readjustments(owner_id);
```

- [ ] **Step 2: Criar down**

```sql
DROP TABLE IF EXISTS lease_readjustments;
```

- [ ] **Step 3: Rodar e validar**

```bash
cd backend && make test-backend-integration 2>&1 | head -30
```
Expected: migrações aplicam; o erro de payment continua até Fase 3.

- [ ] **Step 4: Commit**

```bash
cd backend && git add migrations/000012_create_lease_readjustments.up.sql migrations/000012_create_lease_readjustments.down.sql
git commit -m "feat(db): create lease_readjustments table"
```

---

### Task 5: Migration 000013 — irrf_brackets + seed

**Files:**
- Create: `backend/migrations/000013_create_irrf_brackets.up.sql`
- Create: `backend/migrations/000013_create_irrf_brackets.down.sql`

Os valores do seed refletem a tabela progressiva do IRRF vigente em 2025 (última publicada pela RFB antes de abril/2026). Quando a RFB publicar nova tabela, inserir nova linha com `valid_from` posterior.

- [ ] **Step 1: Criar up**

```sql
CREATE TABLE irrf_brackets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from DATE NOT NULL,
  min_base   FLOAT8 NOT NULL,
  max_base   FLOAT8,
  rate       FLOAT8 NOT NULL,
  deduction  FLOAT8 NOT NULL DEFAULT 0
);

CREATE INDEX idx_irrf_valid_from ON irrf_brackets(valid_from);

-- Tabela progressiva IRRF vigente 2025 (aplicável até nova publicação RFB)
INSERT INTO irrf_brackets (valid_from, min_base, max_base, rate, deduction) VALUES
  ('2024-02-01', 0,        2259.20, 0.0000,   0.00),
  ('2024-02-01', 2259.21,  2826.65, 0.0750, 169.44),
  ('2024-02-01', 2826.66,  3751.05, 0.1500, 381.44),
  ('2024-02-01', 3751.06,  4664.68, 0.2250, 662.77),
  ('2024-02-01', 4664.69,  NULL,    0.2750, 896.00);
```

- [ ] **Step 2: Criar down**

```sql
DROP TABLE IF EXISTS irrf_brackets;
```

- [ ] **Step 3: Rodar e validar seed**

```bash
cd backend && make test-backend-integration 2>&1 | head -30
```
Expected: migrations ok. Confirme o seed:

```bash
docker compose exec postgres psql -U postgres -d inquilinotop_test -c "SELECT min_base, max_base, rate, deduction FROM irrf_brackets ORDER BY min_base;"
```
Expected: 5 linhas.

- [ ] **Step 4: Commit**

```bash
cd backend && git add migrations/000013_create_irrf_brackets.up.sql migrations/000013_create_irrf_brackets.down.sql
git commit -m "feat(db): create irrf_brackets table with 2024 seed"
```

---

## Fase 1 — Tenant: person_type

### Task 6: Tenant model + input types

**Files:**
- Modify: `backend/internal/tenant/model.go`

- [ ] **Step 1: Escrever teste failing**

Modify `backend/internal/tenant/service_test.go` — adicionar teste no topo dos testes do service (após o mock struct):

```go
func TestService_Create_PersonTypeObrigatório(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	_, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name: "Foo",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "person_type")
}

func TestService_Create_PersonTypeInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	invalid := "XX"
	_, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name:       "Foo",
		PersonType: &invalid,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "person_type")
}

func TestService_Create_PersonTypePF(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	pf := "PF"
	out, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name:       "Foo",
		PersonType: &pf,
	})
	require.NoError(t, err)
	assert.Equal(t, "PF", out.PersonType)
}
```

- [ ] **Step 2: Rodar — deve falhar (`PersonType` undefined)**

```bash
cd backend && go test ./internal/tenant/ -run PersonType
```
Expected: FAIL compilation — `PersonType` unknown.

- [ ] **Step 3: Atualizar model.go**

Em `backend/internal/tenant/model.go`:
```go
type Tenant struct {
	ID         uuid.UUID `json:"id"`
	OwnerID    uuid.UUID `json:"owner_id"`
	Name       string    `json:"name"`
	Email      *string   `json:"email,omitempty"`
	Phone      *string   `json:"phone,omitempty"`
	Document   *string   `json:"document,omitempty"`
	PersonType string    `json:"person_type"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateTenantInput struct {
	Name       string  `json:"name"`
	Email      *string `json:"email,omitempty"`
	Phone      *string `json:"phone,omitempty"`
	Document   *string `json:"document,omitempty"`
	PersonType *string `json:"person_type,omitempty"`
}
```

- [ ] **Step 4: Atualizar mock em service_test.go**

Localize o mock `mockTenantRepo.Create` — ajustar para copiar `PersonType` do input (com default `"PF"` se nil):

```go
func (m *mockTenantRepo) Create(_ context.Context, ownerID uuid.UUID, in tenant.CreateTenantInput) (*tenant.Tenant, error) {
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	t := &tenant.Tenant{
		ID: uuid.New(), OwnerID: ownerID, Name: in.Name,
		Email: in.Email, Phone: in.Phone, Document: in.Document,
		PersonType: pt, IsActive: true,
	}
	m.tenants[t.ID] = t
	return t, nil
}
```
Faça o mesmo ajuste em `handler_test.go` se ele tiver um mock próprio.

- [ ] **Step 5: Atualizar service.go**

Em `backend/internal/tenant/service.go`, método `Create`:
```go
func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("tenant.svc: name é obrigatório")
	}
	if in.PersonType == nil {
		return nil, fmt.Errorf("tenant.svc: person_type é obrigatório")
	}
	if *in.PersonType != "PF" && *in.PersonType != "PJ" {
		return nil, fmt.Errorf("tenant.svc: person_type inválido")
	}
	return s.repo.Create(ctx, ownerID, in)
}
```
Aplique validação equivalente em `Update`.

- [ ] **Step 6: Rodar testes de tenant unit**

```bash
cd backend && go test ./internal/tenant/ -run "Service|Handler"
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd backend && git add internal/tenant/model.go internal/tenant/service.go internal/tenant/service_test.go internal/tenant/handler_test.go
git commit -m "feat(tenant): add PersonType (PF|PJ) to model and service validation"
```

---

### Task 7: Tenant repository — persistir person_type

**Files:**
- Modify: `backend/internal/tenant/repository.go`
- Modify: `backend/internal/tenant/repository_test.go`

- [ ] **Step 1: Escrever teste integração failing**

Em `backend/internal/tenant/repository_test.go`, adicionar:

```go
func TestRepository_Create_PersonTypePJ(t *testing.T) {
	d := testDB(t)
	repo := tenant.NewRepository(d)
	ownerID := seedUser(t, d)

	pt := "PJ"
	tn, err := repo.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name:       "Empresa X",
		PersonType: &pt,
	})
	require.NoError(t, err)
	assert.Equal(t, "PJ", tn.PersonType)

	got, err := repo.GetByID(context.Background(), tn.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "PJ", got.PersonType)
}
```
Se `seedUser` não existe em tenant_test, replicar helper de outro repository_test (ex: lease).

- [ ] **Step 2: Rodar — deve falhar por coluna não persistida**

```bash
cd backend && go test ./internal/tenant/ -run PersonTypePJ
```
Expected: FAIL — query SELECT/INSERT não inclui a nova coluna, campo fica vazio.

- [ ] **Step 3: Atualizar repository.go**

Substituir todas as queries para incluir `person_type`:

```go
func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO tenants (owner_id, name, email, phone, document, person_type)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, owner_id, name, email, phone, document, person_type, is_active, created_at, updated_at`,
		ownerID, in.Name, in.Email, in.Phone, in.Document, pt,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: create: %w", err)
	}
	return &t, nil
}
```

Atualizar `GetByID`, `List`, `Update` equivalentemente (adicionar `person_type` ao SELECT e, em Update, ao SET).

Update deve passar a ter `person_type = $N`. Lembre que `CreateTenantInput` é usado em Update — o pattern é o mesmo.

- [ ] **Step 4: Rodar — deve passar**

```bash
cd backend && go test ./internal/tenant/ -run PersonTypePJ
```
Expected: PASS.

- [ ] **Step 5: Rodar todos os testes do módulo tenant**

```bash
cd backend && make test-backend-integration 2>&1 | grep -E "(tenant|FAIL|ok)" | head -30
```
Expected: tenant PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && git add internal/tenant/repository.go internal/tenant/repository_test.go
git commit -m "feat(tenant): persist person_type in all repository queries"
```

---

### Task 8: Tenant handler — Swagger + CLAUDE.md

**Files:**
- Modify: `backend/internal/tenant/handler.go` (Swagger annotations)
- Modify: `backend/internal/tenant/CLAUDE.md`

Não há mudança de código no handler — ele só decodifica o JSON, o service valida. Mas o Swagger precisa refletir o novo campo.

- [ ] **Step 1: Ler handler.go atual**

```bash
cat backend/internal/tenant/handler.go
```

- [ ] **Step 2: Adicionar referência a `person_type` nos exemplos de body nas annotations**

Nas linhas `@Param body body CreateTenantInput ...`, as annotations já pegam o campo automaticamente via o tipo. Confirme que `CreateTenantInput` agora tem `PersonType` — nada a editar no handler.

- [ ] **Step 3: Rodar swag init**

```bash
cd backend && swag init -g cmd/api/main.go -o docs
```
Expected: `docs/` atualizado sem erros.

- [ ] **Step 4: Atualizar CLAUDE.md**

`backend/internal/tenant/CLAUDE.md` — substituir seção Modelo:

```markdown
## Modelo

`Tenant`: id, owner_id, name, email?, phone?, document?, person_type (PF|PJ), is_active

`CreateTenantInput`: name (obrigatório), person_type (obrigatório: PF|PJ), email?, phone?, document?

## Gotchas

- `person_type` é obrigatório no body em POST e PUT.
- Tenants pré-existentes ao migration 000009 vêm com default `'PF'`.
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/tenant/CLAUDE.md docs/
git commit -m "docs(tenant): document person_type + regen swagger"
```

---

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

## Fase 3 — Payment: nova estrutura

### Task 14: Payment model — rename + campos novos + deps

**Files:**
- Modify: `backend/internal/payment/model.go`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat backend/internal/payment/model.go
```

- [ ] **Step 2: Reescrever**

```go
package payment

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID             uuid.UUID  `json:"id"`
	OwnerID        uuid.UUID  `json:"owner_id"`
	LeaseID        uuid.UUID  `json:"lease_id"`
	DueDate        time.Time  `json:"due_date"`
	PaidDate       *time.Time `json:"paid_date,omitempty"`
	GrossAmount    float64    `json:"gross_amount"`
	LateFeeAmount  float64    `json:"late_fee_amount"`
	InterestAmount float64    `json:"interest_amount"`
	IRRFAmount     float64    `json:"irrf_amount"`
	NetAmount      *float64   `json:"net_amount,omitempty"`
	Competency     *string    `json:"competency,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Status         string     `json:"status"`
	Type           string     `json:"type"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type CreatePaymentInput struct {
	LeaseID     uuid.UUID `json:"lease_id"`
	DueDate     time.Time `json:"due_date"`
	GrossAmount float64   `json:"gross_amount"`
	Type        string    `json:"type"`
	Competency  *string   `json:"competency,omitempty"`
	Description *string   `json:"description,omitempty"`
}

type UpdatePaymentInput struct {
	PaidDate    *time.Time `json:"paid_date,omitempty"`
	Status      string     `json:"status"`
	GrossAmount float64    `json:"gross_amount"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error)
	ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
	MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
		lateFee, interest, irrf, netAmount float64) (*Payment, error)
}
```

(`CreateIfAbsent` — insere respeitando unique index, retorna existing + `created=false` se colisão. `MarkPaid` — persiste todos os campos do pagamento quitado.)

- [ ] **Step 3: Build tenta compilar — FAIL esperada**

```bash
cd backend && go build ./... 2>&1 | head -40
```
Expected: erros em service/repository/handler/tests. Próximas tasks arrumam.

- [ ] **Step 4: Commit parcial**

```bash
cd backend && git add internal/payment/model.go
git commit -m "feat(payment): restructure model — gross/fees/irrf/net + competency"
```

---

### Task 15: Payment repository — novas queries

**Files:**
- Modify: `backend/internal/payment/repository.go`
- Modify: `backend/internal/payment/repository_test.go`

- [ ] **Step 1: Escrever testes integração**

Em `repository_test.go`, após helpers, adicionar:

```go
func TestRepository_CreateIfAbsent_Idempotente(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	ownerID, leaseID := seedOwnerAndLease(t, d) // helper que crie owner+property+unit+tenant+lease

	comp := "2026-04"
	in := payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
		Competency: &comp,
	}
	p1, created, err := repo.CreateIfAbsent(context.Background(), ownerID, in)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, p1)

	p2, created, err := repo.CreateIfAbsent(context.Background(), ownerID, in)
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, p1.ID, p2.ID)
}

func TestRepository_MarkPaid_PersisteCamposDerivados(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	ownerID, leaseID := seedOwnerAndLease(t, d)
	p, err := repo.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})
	require.NoError(t, err)

	paid, err := repo.MarkPaid(context.Background(), p.ID, ownerID, time.Now(),
		200, 30, 150, 2080)
	require.NoError(t, err)
	assert.Equal(t, "PAID", paid.Status)
	assert.InDelta(t, 200, paid.LateFeeAmount, 0.01)
	assert.InDelta(t, 30,  paid.InterestAmount, 0.01)
	assert.InDelta(t, 150, paid.IRRFAmount, 0.01)
	require.NotNil(t, paid.NetAmount)
	assert.InDelta(t, 2080, *paid.NetAmount, 0.01)
}
```

- [ ] **Step 2: Rodar — FAIL (compilation)**

```bash
cd backend && go test ./internal/payment/ -run Idempotente
```

- [ ] **Step 3: Implementar repository.go**

Reescrever completo (é mais simples do que patchear):

```go
package payment

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

const paymentCols = `id, owner_id, lease_id, due_date, paid_date,
  gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount,
  competency, description, status, type, created_at, updated_at`

func scanPayment(row pgx.Row, p *Payment) error {
	return row.Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate,
		&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount,
		&p.Competency, &p.Description, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING `+paymentCols,
		ownerID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 ON CONFLICT (lease_id, competency, type) WHERE competency IS NOT NULL DO NOTHING
		 RETURNING `+paymentCols,
		ownerID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err == nil {
		return &p, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: %w", err)
	}
	// Conflito — buscar o existente
	if in.Competency == nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: insert silently skipped without competency")
	}
	var existing Payment
	err = scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+`
		 FROM payments
		 WHERE lease_id=$1 AND competency=$2 AND type=$3 AND owner_id=$4`,
		in.LeaseID, *in.Competency, in.Type, ownerID,
	), &existing)
	if err != nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent lookup: %w", err)
	}
	return &existing, false, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE lease_id=$1 AND owner_id=$2 ORDER BY due_date`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by lease: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := scanPayment(rows, &p); err != nil {
			return nil, fmt.Errorf("payment.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payment.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments SET paid_date=$1, status=$2, gross_amount=$3, updated_at=NOW()
		 WHERE id=$4 AND owner_id=$5
		 RETURNING `+paymentCols,
		in.PaidDate, in.Status, in.GrossAmount, id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
	lateFee, interest, irrf, netAmount float64) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments
		 SET paid_date=$1, status='PAID',
		     late_fee_amount=$2, interest_amount=$3, irrf_amount=$4, net_amount=$5,
		     updated_at=NOW()
		 WHERE id=$6 AND owner_id=$7
		 RETURNING `+paymentCols,
		paidDate, lateFee, interest, irrf, netAmount, id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: mark paid: %w", err)
	}
	return &p, nil
}
```

- [ ] **Step 4: Rodar — PASS**

```bash
cd backend && go test ./internal/payment/ -run Idempotente
cd backend && go test ./internal/payment/ -run MarkPaid
```

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/payment/repository.go internal/payment/repository_test.go
git commit -m "feat(payment): repository — CreateIfAbsent + MarkPaid + new cols"
```

---

## Fase 4 — Fiscal: IRRFTable

### Task 16: Fiscal module — skeleton + IRRFTable

**Files:**
- Create: `backend/internal/fiscal/model.go`
- Create: `backend/internal/fiscal/irrf.go`
- Create: `backend/internal/fiscal/irrf_test.go`
- Create: `backend/internal/fiscal/repository.go` (parcial — só brackets)
- Create: `backend/internal/fiscal/repository_test.go`

- [ ] **Step 1: Escrever testes de IRRFTable (unit — com mock de leitura)**

`backend/internal/fiscal/irrf_test.go`:
```go
package fiscal_test

import (
	"context"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockBracketsRepo struct {
	brackets []fiscal.IRRFBracket
}

func (m *mockBracketsRepo) ActiveBrackets(_ context.Context, at time.Time) ([]fiscal.IRRFBracket, error) {
	var out []fiscal.IRRFBracket
	for _, b := range m.brackets {
		if !b.ValidFrom.After(at) {
			out = append(out, b)
		}
	}
	return out, nil
}

func seed2024() *mockBracketsRepo {
	vf, _ := time.Parse("2006-01-02", "2024-02-01")
	max1 := 2826.65
	max2 := 3751.05
	max3 := 4664.68
	return &mockBracketsRepo{
		brackets: []fiscal.IRRFBracket{
			{ValidFrom: vf, MinBase: 0,       MaxBase: func() *float64 { x := 2259.20; return &x }(), Rate: 0,       Deduction: 0},
			{ValidFrom: vf, MinBase: 2259.21, MaxBase: &max1, Rate: 0.075, Deduction: 169.44},
			{ValidFrom: vf, MinBase: 2826.66, MaxBase: &max2, Rate: 0.15,  Deduction: 381.44},
			{ValidFrom: vf, MinBase: 3751.06, MaxBase: &max3, Rate: 0.225, Deduction: 662.77},
			{ValidFrom: vf, MinBase: 4664.69, MaxBase: nil,   Rate: 0.275, Deduction: 896.00},
		},
	}
}

func TestIRRFTable_Isento(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	v, err := tab.Calculate(context.Background(), 2000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 0, v, 0.01)
}

func TestIRRFTable_FaixaIntermediaria(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	// base 3000: faixa 3 (2826.66..3751.05), rate 0.15, dedução 381.44
	// imposto = 3000 * 0.15 - 381.44 = 450 - 381.44 = 68.56
	v, err := tab.Calculate(context.Background(), 3000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 68.56, v, 0.01)
}

func TestIRRFTable_FaixaTopo(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	// base 10000: faixa 5, rate 0.275, dedução 896
	// imposto = 10000 * 0.275 - 896 = 2750 - 896 = 1854
	v, err := tab.Calculate(context.Background(), 10000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 1854, v, 0.01)
}

func TestIRRFTable_SemFaixaValida(t *testing.T) {
	tab := fiscal.NewIRRFTable(&mockBracketsRepo{})
	_, err := tab.Calculate(context.Background(), 3000, time.Now())
	require.Error(t, err)
}
```

- [ ] **Step 2: Rodar — FAIL compilation**

```bash
cd backend && go test ./internal/fiscal/
```

- [ ] **Step 3: Criar model.go**

`backend/internal/fiscal/model.go`:
```go
package fiscal

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type IRRFBracket struct {
	ID         uuid.UUID `json:"id"`
	ValidFrom  time.Time `json:"valid_from"`
	MinBase    float64   `json:"min_base"`
	MaxBase    *float64  `json:"max_base,omitempty"`
	Rate       float64   `json:"rate"`
	Deduction  float64   `json:"deduction"`
}

type BracketsRepository interface {
	// IRRF tabela progressiva: IN RFB 1.500/2014 art. 22. Faixas versionadas
	// por valid_from permitem atualização sem código novo quando RFB publica.
	ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error)
}

// IRRFTable é consumida por payment.Service no MarkPaid.
type IRRFTable interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}
```

- [ ] **Step 4: Criar irrf.go**

`backend/internal/fiscal/irrf.go`:
```go
package fiscal

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"
)

type irrfTable struct {
	repo BracketsRepository
}

func NewIRRFTable(repo BracketsRepository) IRRFTable {
	return &irrfTable{repo: repo}
}

func (t *irrfTable) Calculate(ctx context.Context, base float64, at time.Time) (float64, error) {
	if base < 0 {
		return 0, fmt.Errorf("fiscal.irrf: base negativa")
	}
	brackets, err := t.repo.ActiveBrackets(ctx, at)
	if err != nil {
		return 0, fmt.Errorf("fiscal.irrf: load brackets: %w", err)
	}
	if len(brackets) == 0 {
		return 0, fmt.Errorf("fiscal.irrf: sem faixas válidas para %s", at.Format("2006-01-02"))
	}
	// Dentre brackets com mesmo valid_from (o mais recente <= at), achar a faixa da base.
	sort.Slice(brackets, func(i, j int) bool { return brackets[i].ValidFrom.After(brackets[j].ValidFrom) })
	latest := brackets[0].ValidFrom
	for _, b := range brackets {
		if !b.ValidFrom.Equal(latest) {
			continue
		}
		if base < b.MinBase {
			continue
		}
		if b.MaxBase != nil && base > *b.MaxBase {
			continue
		}
		v := base*b.Rate - b.Deduction
		if v < 0 {
			v = 0
		}
		return math.Round(v*100) / 100, nil
	}
	return 0, fmt.Errorf("fiscal.irrf: sem faixa para base %.2f em %s", base, at.Format("2006-01-02"))
}
```

- [ ] **Step 5: Rodar — PASS**

```bash
cd backend && go test ./internal/fiscal/ -run IRRFTable
```

- [ ] **Step 6: Criar repository.go (pg impl)**

`backend/internal/fiscal/repository.go`:
```go
package fiscal

import (
	"context"
	"fmt"
	"time"

	"github.com/inquilinotop/api/pkg/db"
)

type pgBracketsRepository struct{ db *db.DB }

func NewBracketsRepository(database *db.DB) BracketsRepository {
	return &pgBracketsRepository{db: database}
}

func (r *pgBracketsRepository) ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, valid_from, min_base, max_base, rate, deduction
		 FROM irrf_brackets
		 WHERE valid_from = (
		   SELECT MAX(valid_from) FROM irrf_brackets WHERE valid_from <= $1
		 )
		 ORDER BY min_base`, at,
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.brackets.repo: %w", err)
	}
	defer rows.Close()
	var list []IRRFBracket
	for rows.Next() {
		var b IRRFBracket
		if err := rows.Scan(&b.ID, &b.ValidFrom, &b.MinBase, &b.MaxBase, &b.Rate, &b.Deduction); err != nil {
			return nil, fmt.Errorf("fiscal.brackets.repo: scan: %w", err)
		}
		list = append(list, b)
	}
	return list, rows.Err()
}
```

- [ ] **Step 7: Teste integração do seed**

`backend/internal/fiscal/repository_test.go`:
```go
package fiscal_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/fiscal"
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
	t.Cleanup(func() { d.Close() })
	return d
}

func TestBracketsRepository_Seed2024(t *testing.T) {
	d := testDB(t)
	repo := fiscal.NewBracketsRepository(d)
	at, _ := time.Parse("2006-01-02", "2026-04-15")
	bs, err := repo.ActiveBrackets(context.Background(), at)
	require.NoError(t, err)
	assert.Len(t, bs, 5)
	assert.InDelta(t, 0.275, bs[len(bs)-1].Rate, 0.0001)
}
```

(Note: não truncar `irrf_brackets` — é seed estática.)

- [ ] **Step 8: Rodar integração**

```bash
cd backend && go test ./internal/fiscal/ -run BracketsRepository
```

- [ ] **Step 9: Commit**

```bash
cd backend && git add internal/fiscal/
git commit -m "feat(fiscal): IRRFTable + BracketsRepository with pg impl"
```

---

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

## Fase 7 — Wire-up + integração + docs

### Task 22: main.go — composição completa

**Files:**
- Modify: `backend/cmd/api/main.go`

Nesta altura:
- `payment.NewService` exige 5 args (repo, leaseReader, tenantReader, unitReader, ownerReader, irrf).
- `lease.NewService` exige 2 args (repo, readjRepo).
- `fiscal` precisa de dois repos pg.

`payment.Service` consome leases/tenants/units/owner via adaptadores mínimos. Você precisa criar adaptadores finos em `main.go` que envolvem `lease.Repository` e `tenant.Repository` para satisfazer as interfaces de `payment.LeaseReader` etc. Os types já são compatíveis (a interface `LeaseReader` importa `lease.Lease`) — **pode passar `leaseRepo` direto** pois já implementa `GetByID(ctx, id, ownerID) (*lease.Lease, error)`.

Para `UnitReader` e `OwnerReader`, as interfaces pedem tipos locais (`UnitSummary`, `OwnerSummary`). Crie adaptadores em `main.go` ou em `internal/payment/adapters.go`. Para manter main.go limpo, crie `internal/payment/adapters.go`:

- [ ] **Step 1: Criar adapters.go**

`backend/internal/payment/adapters.go`:
```go
package payment

import (
	"context"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/property"
)

type UnitReaderAdapter struct {
	Units    property.UnitRepository    // hypothetical; ajuste se o nome difere
	Property property.Repository
}

func (a *UnitReaderAdapter) GetByID(ctx context.Context, unitID, ownerID uuid.UUID) (*UnitSummary, error) {
	// Ajuste: a unit no projeto pode estar dentro de property; recupere a.Units.GetByID ou equivalente.
	// Este adapter faz o link com o modelo real. Se a API de property expõe ListUnitsByProperty
	// você precisará criar um GetUnit(unitID) ou adaptar.
	// Placeholder — veja property/CLAUDE.md para o método real.
	return nil, nil
}

type OwnerReaderAdapter struct {
	Users identity.Repository
}

func (a *OwnerReaderAdapter) GetByID(ctx context.Context, ownerID uuid.UUID) (*OwnerSummary, error) {
	u, err := a.Users.GetByID(ctx, ownerID)
	if err != nil { return nil, err }
	// ajuste nomes conforme identity.User
	var doc *string
	return &OwnerSummary{ID: ownerID, Name: u.Email, Document: doc}, nil
}
```

**Importante:** antes de escrever os adapters, **leia** `internal/property/model.go` e `internal/identity/model.go` para saber os nomes reais dos métodos e campos. Se `property.UnitRepository` não existir como interface pública, você tem duas opções:
  (a) adicionar um método `GetUnitByID(ctx, unitID, ownerID)` à interface pública de property, implementar no pgRepository e usar aqui;
  (b) aceitar que `unit_reader` retorne `nil` (e ajustar `BuildReceipt` para tolerar unit nil — renderiza com campos vazios).

Escolha a opção (a) se for rápido; (b) se precisar evitar refactor de property. Documente a escolha no commit.

- [ ] **Step 2: Atualizar main.go**

```go
// após os repos existentes:
leaseReadjRepo := lease.NewReadjustmentRepository(database)
leaseSvc := lease.NewService(leaseRepo, leaseReadjRepo)

bracketsRepo := fiscal.NewBracketsRepository(database)
aggRepo := fiscal.NewAggregateRepository(database)
irrfTable := fiscal.NewIRRFTable(bracketsRepo)
fiscalSvc := fiscal.NewService(aggRepo)
fiscalHandler := fiscal.NewHandler(fiscalSvc)

unitAdapter := &payment.UnitReaderAdapter{/* passes */}
ownerAdapter := &payment.OwnerReaderAdapter{Users: identityRepo}

paymentSvc := payment.NewService(paymentRepo, leaseRepo, tenantRepo, unitAdapter, ownerAdapter, irrfTable)
paymentHandler := payment.NewHandler(paymentSvc)
// ...
fiscalHandler.Register(r, authMW)
```

- [ ] **Step 3: Compilar**

```bash
cd backend && go build ./...
```
Ajustar qualquer erro de import/assinatura.

- [ ] **Step 4: Testes unitários completos**

```bash
cd backend && make test-backend
```
Expected: todo PASS.

- [ ] **Step 5: Commit**

```bash
cd backend && git add internal/payment/adapters.go cmd/api/main.go
git commit -m "feat(main): wire fiscal module + payment deps in composition root"
```

---

### Task 23: Teste de integração ponta-a-ponta

**Files:**
- Create: `backend/internal/fiscal/e2e_test.go`

- [ ] **Step 1: Escrever teste**

```go
//go:build integration

package fiscal_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestE2E_CicloFiscalCompleto(t *testing.T) {
	d := testDB(t)

	// 1) Owner + property + unit + tenant (PJ) + lease com regras fiscais.
	ownerID := seedUser(t, d)
	unitID := seedUnitForOwner(t, d, ownerID)
	pj := "PJ"
	tnRepo := tenant.NewRepository(d)
	tn, err := tnRepo.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name: "Empresa X", PersonType: &pj,
	})
	require.NoError(t, err)

	leaseRepo := lease.NewRepository(d)
	iptu := 1800.0
	year := 2026
	l, err := leaseRepo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tn.ID,
		StartDate: time.Date(2026, 1, 10, 0,0,0,0, time.UTC),
		RentAmount: 2500,
		LateFeePercent: 0.10, DailyInterestPercent: 0.001,
		IPTUReimbursable: true, AnnualIPTUAmount: &iptu, IPTUYear: &year,
	})
	require.NoError(t, err)

	// 2) Setup payment service
	bracketsRepo := fiscal.NewBracketsRepository(d)
	irrf := fiscal.NewIRRFTable(bracketsRepo)
	payRepo := payment.NewRepository(d)
	readjRepo := lease.NewReadjustmentRepository(d)
	_ = readjRepo
	// Adapters mínimos para satisfazer o service
	unitAd := // ... (mock simples ou real)
	ownerAd := // ... (mock simples ou real)
	paySvc := payment.NewService(payRepo, leaseRepo, tnRepo, unitAd, ownerAd, irrf)

	// 3) Gera 3 meses
	for _, m := range []string{"2026-01", "2026-02", "2026-03"} {
		_, err := paySvc.GenerateMonth(context.Background(), l.ID, ownerID, m)
		require.NoError(t, err)
	}

	// 4) Marcar 2 como PAID: um no prazo, um com 10 dias atraso
	// Buscar payments RENT
	list, err := paySvc.ListByLease(context.Background(), l.ID, ownerID)
	require.NoError(t, err)
	var rents []payment.Payment
	for _, p := range list { if p.Type == "RENT" { rents = append(rents, p) } }
	require.Len(t, rents, 3)

	// Pagar rents[0] no dia do vencimento
	paid1 := rents[0].DueDate
	upd := payment.UpdatePaymentInput{PaidDate: &paid1, Status: "PAID", GrossAmount: rents[0].GrossAmount}
	p1, err := paySvc.Update(context.Background(), rents[0].ID, ownerID, upd)
	require.NoError(t, err)
	// Tenant PJ → IRRF aplicado
	assert.Greater(t, p1.IRRFAmount, 0.0)

	// Pagar rents[1] com 10 dias atraso
	paid2 := rents[1].DueDate.AddDate(0, 0, 10)
	upd2 := payment.UpdatePaymentInput{PaidDate: &paid2, Status: "PAID", GrossAmount: rents[1].GrossAmount}
	p2, err := paySvc.Update(context.Background(), rents[1].ID, ownerID, upd2)
	require.NoError(t, err)
	assert.Greater(t, p2.LateFeeAmount, 0.0)
	assert.Greater(t, p2.InterestAmount, 0.0)

	// 5) Relatório anual
	aggRepo := fiscal.NewAggregateRepository(d)
	fiscalSvc := fiscal.NewService(aggRepo)
	rep, err := fiscalSvc.AnnualReport(context.Background(), ownerID, 2026)
	require.NoError(t, err)

	require.NotEmpty(t, rep.Leases)
	var target *fiscal.AnnualLeaseReport
	for i, lr := range rep.Leases { if lr.LeaseID == l.ID { target = &rep.Leases[i] } }
	require.NotNil(t, target)
	assert.Equal(t, "PJ_WITHHELD", target.Category)
	assert.Greater(t, target.TotalIRRFWithheld, 0.0)
	assert.Greater(t, rep.Totals.ReceivedFromPJ, 0.0)
	assert.Equal(t, 0.0, rep.Totals.ReceivedFromPF) // tenant é PJ
}
```

Ajuste os helpers `seedUser`, `seedUnitForOwner`, etc., e os adapters conforme as estruturas reais.

- [ ] **Step 2: Rodar**

```bash
cd backend && make test-backend-integration 2>&1 | grep -E "(E2E|PASS|FAIL)"
```

- [ ] **Step 3: Commit**

```bash
cd backend && git add internal/fiscal/e2e_test.go
git commit -m "test(fiscal): e2e ciclo completo (3 meses, PJ tenant, IRRF + atraso)"
```

---

### Task 24: swag init + CLAUDE.md consolidado

**Files:**
- Modify: `backend/docs/*`
- Modify: `backend/CLAUDE.md`

- [ ] **Step 1: Regerar docs Swagger**

```bash
cd backend && swag init -g cmd/api/main.go -o docs
```
Expected: `docs/` atualizado sem erros.

- [ ] **Step 2: Atualizar `backend/CLAUDE.md` — tabela de módulos**

Adicionar linha:
```markdown
| fiscal | [internal/fiscal/CLAUDE.md](internal/fiscal/CLAUDE.md) |
```

- [ ] **Step 3: Atualizar `backend/internal/lease/CLAUDE.md`**

Na seção Modelo, listar os 5 novos campos. Na seção Rotas, as duas novas. Na gotchas: "Readjust cria um `lease_readjustments` e atualiza `rent_amount` — não retroage sobre payments gerados."

- [ ] **Step 4: Atualizar `backend/internal/payment/CLAUDE.md`**

Atualizar Modelo para refletir `GrossAmount`, multa/juros/IRRF/net, competency, description. Rotas: `/generate`, `/receipt`. Gotchas:
- "Rename `amount → gross_amount` na migration 000011."
- "`GenerateMonth` é idempotente por `(lease_id, competency, type)`."
- "`Update` com paid_date + status=PAID dispara cálculo de IRRF (se RENT+PJ)."
- "Receipt só disponível com status PAID."

- [ ] **Step 5: Atualizar raiz `CLAUDE.md`**

Adicionar módulo `fiscal` na tabela de módulos.

- [ ] **Step 6: Commit final**

```bash
cd .. && git add backend/docs/ backend/CLAUDE.md backend/internal/lease/CLAUDE.md backend/internal/payment/CLAUDE.md CLAUDE.md
git commit -m "docs: update CLAUDE.md hierarchy + regen swagger for fiscal module"
```

---

## Verificação final

- [ ] **Build limpo**: `cd backend && go build ./...`
- [ ] **Testes unit passam**: `cd backend && make test-backend`
- [ ] **Testes integração passam**: `cd backend && make test-backend-integration`
- [ ] **Swagger sem warnings**: `cd backend && swag init -g cmd/api/main.go -o docs 2>&1 | grep -i warn`
- [ ] **Migrations idempotentes**: rodar duas vezes, sem erros

## Cobertura vs Spec

| Requisito da Spec | Task |
|---|---|
| Migration tenants.person_type | 1 |
| Migration leases fiscal fields | 2 |
| Migration payments breakdown | 3 |
| Migration lease_readjustments | 4 |
| Migration irrf_brackets + seed | 5 |
| Tenant person_type (model/service/repo/handler) | 6, 7, 8 |
| Lease model extensions | 9 |
| Lease repository fiscal fields | 10 |
| Readjustment repository | 11 |
| Readjust service transacional + validações | 12 |
| Readjust handler + endpoints | 13 |
| Payment model (rename + breakdown) | 14 |
| Payment repository CreateIfAbsent + MarkPaid | 15 |
| Fiscal IRRFTable + brackets repo | 16 |
| Payment Enrich on-read | 17 |
| Payment GenerateMonth idempotente + IPTU | 18 |
| Payment /generate + /receipt + BuildReceipt | 19 |
| Fiscal AnnualReport service + agg repo | 20 |
| Fiscal handler | 21 |
| Composição main.go + adapters | 22 |
| E2E ciclo completo | 23 |
| Swagger + docs | 24 |

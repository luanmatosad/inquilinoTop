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

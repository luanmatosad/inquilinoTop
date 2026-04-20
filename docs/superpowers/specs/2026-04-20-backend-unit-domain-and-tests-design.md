# Design: Domínio Unit + Testes Faltantes

**Data:** 2026-04-20
**Branch:** backend/planning
**Decisão:** Opção A — unit como domínio independente, property.Service coordena auto-criação

---

## Contexto

O backend Go tem todos os domínios da fase anterior implementados (lease, payment, expense, property, tenant, identity) com Swagger funcionando. O domínio `unit` já está **completamente implementado dentro do pacote `property`** (model, repository, service, handler, Swagger) — não é necessário criar `internal/unit/`. Os domínios `lease`, `payment` e `expense` estão sem testes de service e/ou handler, e o pacote `property` tem cobertura parcial de testes (3 service tests, 1 handler test), faltando casos para as operações de unit.

---

## Arquitetura

### Estado real do domínio `unit`

`unit` já está implementado **dentro do pacote `property`**:

```
backend/internal/property/
├── model.go          # Unit + CreateUnitInput definidos aqui
├── repository.go     # CreateUnit, GetUnit, ListUnits, UpdateUnit, DeleteUnit
├── service.go        # CreateUnit, GetUnit, ListUnits, UpdateUnit, DeleteUnit
│                     # + auto-criação SINGLE já implementada
├── handler.go        # Endpoints unit já registrados com Swagger
├── handler_test.go   # 1 teste (ListUnits route) — precisa de mais
├── service_test.go   # 3 testes (property) — falta cobertura de unit ops
└── repository_test.go
```

### Auto-criação SINGLE

Já implementada em `property.Service.CreateProperty`: ao receber tipo `SINGLE`, chama `s.repo.CreateUnit(ctx, p.ID, CreateUnitInput{Label: "Unidade 01", Notes: &notes})`. Nenhuma mudança necessária.

---

## Endpoints (já implementados)

```
GET    /api/v1/properties/{id}/units   lista units do imóvel
POST   /api/v1/properties/{id}/units   cria unit
GET    /api/v1/units/{id}              busca unit por ID
PUT    /api/v1/units/{id}              atualiza unit
DELETE /api/v1/units/{id}              soft-delete (is_active=false)
```

`unit` não tem `owner_id` direto — isolamento é feito via `property_id → property.owner_id`.

---

## Testes Faltantes

| Domínio | service_test | handler_test |
|---------|-------------|--------------|
| `property` (operações unit) | ⚠️ parcial | ⚠️ parcial |
| `lease` | ❌ adicionar | ⚠️ apenas End/Renew |
| `payment` | ❌ adicionar | ❌ adicionar |
| `expense` | ❌ adicionar | ❌ adicionar |

### Casos obrigatórios — service_test

- **lease**: CreateLease (válido), GetByID (encontrado, not found), List, UpdateLease (status), Delete
- **payment**: CreatePayment, GetByID, ListByLease, UpdatePayment (marcar pago)
- **expense**: CreateExpense, GetByID, ListByUnit, UpdateExpense, Delete

### Casos obrigatórios — handler_test

Aplicar a `payment` e `expense`:

- Body inválido → 400 `INVALID_BODY`
- UUID inválido na URL → 400 `INVALID_ID`
- Service retorna `ErrNotFound` → 404 `NOT_FOUND`
- Operação bem-sucedida → 200/201 com payload correto

### Padrão mock

```go
type mockRepo struct { items map[uuid.UUID]*Xxx }
func newMockRepo() *mockRepo { return &mockRepo{items: map[uuid.UUID]*Xxx{}} }
```

---

## Ordem de Implementação

1. Expandir `property/service_test.go` — adicionar casos para operações de unit
2. Expandir `property/handler_test.go` — adicionar casos para handlers de unit e property
3. Criar `lease/service_test.go` — cobertura completa do service
4. Expandir `lease/handler_test.go` — adicionar casos CRUD além de End/Renew
5. Criar `payment/service_test.go` + `payment/handler_test.go`
6. Criar `expense/service_test.go` + `expense/handler_test.go`

---

## Critérios de Sucesso

- `make test-backend` passa sem erros
- `make test-backend-integration` passa sem erros (requer Docker)
- `property/service_test.go` e `property/handler_test.go` cobrem operações de unit (create, get, list, update, delete)
- `lease/service_test.go` cobre Create (válido + inválido), Get, List, Update, Delete, End, Renew
- `payment/service_test.go` e `payment/handler_test.go` cobrem Create, Get, ListByLease, Update
- `expense/service_test.go` e `expense/handler_test.go` cobrem Create, Get, ListByUnit, Update, Delete

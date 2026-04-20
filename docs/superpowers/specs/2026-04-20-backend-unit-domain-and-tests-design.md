# Design: Domínio Unit + Testes Faltantes

**Data:** 2026-04-20
**Branch:** backend/planning
**Decisão:** Opção A — unit como domínio independente, property.Service coordena auto-criação

---

## Contexto

O backend Go tem todos os domínios da fase anterior implementados (lease, payment, expense, property, tenant, identity) com Swagger funcionando. O domínio `unit` tem migration existente (`000004_create_units`) mas nenhum código Go. Os domínios `lease`, `payment` e `expense` estão sem testes de service e/ou handler.

---

## Arquitetura

### Novo domínio `unit`

```
backend/internal/unit/
├── model.go
├── repository.go
├── service.go
├── handler.go
├── handler_test.go
├── service_test.go
└── repository_test.go
```

### Interface Repository

```go
type Repository interface {
    Create(ctx context.Context, propertyID uuid.UUID, in CreateUnitInput) (*Unit, error)
    GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Unit, error)
    ListByProperty(ctx context.Context, propertyID, ownerID uuid.UUID) ([]Unit, error)
    Update(ctx context.Context, id, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error)
    Delete(ctx context.Context, id, ownerID uuid.UUID) error
}
```

### Auto-criação SINGLE

`property.Service` recebe `unit.Repository` como dependência adicional. Ao criar uma property do tipo `SINGLE`, chama `unitRepo.Create(...)` com label `"Unidade 01"` dentro do mesmo fluxo de `CreateProperty`.

```go
func NewService(repo Repository, unitRepo unit.Repository) *Service
```

A composição é atualizada em `cmd/api/main.go`.

---

## Endpoints

Todos protegidos por `authMW`. `ownerID` extraído do JWT.

```
GET    /api/v1/properties/{propertyId}/units   lista units do imóvel
POST   /api/v1/properties/{propertyId}/units   cria unit
GET    /api/v1/units/{id}                      busca unit por ID
PUT    /api/v1/units/{id}                      atualiza unit
DELETE /api/v1/units/{id}                      soft-delete (is_active=false)
```

`unit` não tem `owner_id` direto — isolamento é feito via `property_id → property.owner_id` nas queries.

---

## Testes Faltantes

| Domínio | service_test | handler_test |
|---------|-------------|--------------|
| `lease` | ❌ adicionar | ✅ existe |
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

1. Domínio `unit` — model → repository → service → handler → testes (service, handler, repository)
2. Atualizar `property.Service` — dependência `unit.Repository`, auto-criação SINGLE, atualizar `main.go`
3. Testes de `lease` — `service_test.go`
4. Testes de `payment` — `service_test.go` + `handler_test.go`
5. Testes de `expense` — `service_test.go` + `handler_test.go`
6. Swagger — anotar handlers de `unit`, rodar `swag init`

---

## Critérios de Sucesso

- `make test-backend` passa sem erros
- `make test-backend-integration` passa sem erros (requer Docker)
- `GET /api/v1/properties/{id}/units` retorna `[]` (não null) para imóvel sem units
- Criar `Property` do tipo `SINGLE` auto-cria unit com label `"Unidade 01"`
- Swagger UI exibe os novos endpoints de `unit`
- Todos os domínios `lease`, `payment`, `expense` têm service_test e handler_test passando

# Fase 4: Domain Repository Migration (owner_id → organization_id)

## Status: ⏳ Pendente

### Tasks

#### Model Updates (Tasks 9.1 a 9.5)
- [ ] 9.1 `property/model.go` — substituir `OwnerID uuid.UUID` por `OrganizationID uuid.UUID`
- [ ] 9.2 `tenant/model.go` — substituir `OwnerID` por `OrganizationID`
- [ ] 9.3 `lease/model.go` — substituir `OwnerID` por `OrganizationID`
- [ ] 9.4 `payment/model.go` — substituir `OwnerID` por `OrganizationID`
- [ ] 9.5 Services — buscar `organizationID` do contexto ao invés de parâmetro

#### Repository Updates (Tasks 8.1 a 8.5)
- [ ] 8.1 `property/repository.go` — filtrar por `organization_id` onde antes era `owner_id`
  - `Create`: recebe `organizationID` do service
  - `GetByID`, `List`, `Update`, `Delete`: filtro `organization_id = $2`
  - `GetUnit`, `UpdateUnit`, `DeleteUnit`: JOIN com properties + `organization_id`
- [ ] 8.2 `tenant/repository.go` — filtro `organization_id` em todas as queries
- [ ] 8.3 `lease/repository.go` — filtro `organization_id` em todas as queries
  - `GetByID`, `List`, `Create`, `Update`, `End`, `Renew`, `UpdateRentAmount`
- [ ] 8.4 `payment/repository.go` — filtro `organization_id`
  - `Create`, `CreateIfAbsent`, `GetByID`, `ListByLease`, `ListByOwner`, `Update`, `MarkPaid`
  - `FinancialConfig` queries: `GetActiveFinancialConfig`, `GetFinancialConfig`, etc.
- [ ] 8.5 `expense/repository.go` — filtro `organization_id`

#### Handler Updates (Tasks 10.1 a 10.6)
- [ ] 10.1 `property/handler.go` — extrair `organizationID` de `auth.OrganizationIDFromCtx(r.Context())`
  - Não recebe mais `ownerID` como parâmetro nos métodos do service
- [ ] 10.2 `tenant/handler.go` — extrair do contexto
- [ ] 10.3 `lease/handler.go` — extrair do contexto
- [ ] 10.4 `payment/handler.go` — extrair do contexto
- [ ] 10.5 `expense/handler.go` — extrair do contexto
- [ ] 10.6 Todos os handlers passam `organizationID` ao service

### Dependências
- ⛔ Requer que **Fase 1** (Auth/JWT) esteja completa
- ⛔ Requer que **Fase 3** (RBAC middleware) esteja completa (handlers precisam extrair org do contexto)

### Ordem de Implementação
1. Models (9.1 a 9.5) — atualizar structs primeiro
2. Repositories (8.1 a 8.5) — atualizar queries
3. Services — buscar `organizationID` do contexto
4. Handlers (10.1 a 10.6) — extrair do contexto

### Arquivos a Modificar
- `backend/internal/property/model.go`
- `backend/internal/property/repository.go`
- `backend/internal/property/service.go`
- `backend/internal/property/handler.go`
- `backend/internal/tenant/model.go`
- `backend/internal/tenant/repository.go`
- `backend/internal/tenant/service.go`
- `backend/internal/tenant/handler.go`
- `backend/internal/lease/model.go`
- `backend/internal/lease/repository.go`
- `backend/internal/lease/service.go`
- `backend/internal/lease/handler.go`
- `backend/internal/payment/model.go`
- `backend/internal/payment/repository.go`
- `backend/internal/payment/service.go`
- `backend/internal/payment/handler.go`
- `backend/internal/expense/model.go`
- `backend/internal/expense/repository.go`
- `backend/internal/expense/service.go`
- `backend/internal/expense/handler.go`

### Nota Importante
- Tasks 11.1 e 11.2 (constraints e migrations down) foram integradas nas fases anteriores
- Foreign keys de `organization_id` foram adicionadas na migration 000031
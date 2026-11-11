# Fase 3: RBAC Hierárquico & Middleware Integration

## Status: ⏳ Pendente

### Tasks

#### RBAC Service Update (Tasks 6.1 a 6.4)
- [ ] 6.1 Atualizar `rbac/model.go`
  - Adicionar roles: `manager`, `employee` (além de `owner`, `admin`, `viewer` existentes)
  - Roles existentes mantidos para compatibilidade
- [ ] 6.2 Criar matriz de permissões em `rbac/service.go`
  - Definição de permissões por action: `property:read`, `property:write`, `tenant:read`, `tenant:write`, `lease:read`, `lease:write`, `payment:read`, `payment:write`, `member:invite`, `member:manage`, `branch:manage`, `org:read`, `org:update`
  - Hierarquia: `owner` > `admin` > `manager` > `employee` > `viewer`
  - Método `HasPermission(role, permission)` com herança
  - Método `GetUserPermissions(userID, orgID)` — busca membership e retorna permissões
- [ ] 6.3 Atualizar `rbac/AssignRoleInput` para incluir `organization_id` e `branch_id`
- [ ] 6.4 Adicionar método `CheckPermission(ctx, orgID, role, permission)`

#### RBAC Middleware (Tasks 7.1 a 7.4)
- [ ] 7.1 Atualizar `rbac/middleware.go`
  - Checar permission por action, não por role
  - Extrair `organization_id` e `branch_id` do contexto
  - Verificar se membership permite a action no escopo
- [ ] 7.2 Atualizar `main.go` para aplicar RBAC middleware
  - Criar wrapper por domínio: `PropertyRBAC`, `TenantRBAC`, `LeaseRBAC`, `PaymentRBAC`, etc.
- [ ] 7.3 Mapear permissões por rota
  - `POST/PUT/DELETE /properties` → `property:write`
  - `GET /properties` → `property:read`
  - `POST/PUT/DELETE /tenants` → `tenant:write`
  - `GET /tenants` → `tenant:read`
  - `POST/PUT/DELETE /leases` → `lease:write`
  - `GET /leases` → `lease:read`
  - `POST/PUT/DELETE /payments` → `payment:write`
  - `GET /payments` → `payment:read`
  - Convites e membros → `member:invite` / `member:manage`
  - Branches → `branch:manage`
- [ ] 7.4 Middleware deve buscar membership do usuário se não vier no JWT

### Dependências
- ⛔ Requer que **Fase 2** (Organization Domain) esteja completa
- O middleware precisa do `organization` repository para buscar membership

### Ordem de Implementação
1. `rbac/model.go` (roles)
2. `rbac/service.go` (permissões + matriz)
3. `rbac/middleware.go` (apenas authorization, não auth — auth já existe)
4. `main.go` (aplicar middleware)

### Arquivos a Modificar
- `backend/internal/rbac/model.go`
- `backend/internal/rbac/service.go`
- `backend/internal/rbac/middleware.go`
- `backend/cmd/api/main.go`
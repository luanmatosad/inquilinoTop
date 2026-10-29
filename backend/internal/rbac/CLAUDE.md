# rbac — Controle de Acesso por Papel

Gerencia roles de usuários, escopadas a `organization_id` (+ `branch_id` opcional). Hierarquia de 5 papéis com matriz de permissões por recurso:ação, aplicada via middleware em todas as rotas de domínio.

## Modelo

`UserRole`: id, user_id, role, organization_id?, branch_id?, created_at

`RoleType`: `owner` > `admin` > `manager` > `employee` > `viewer` (hierarquia nessa ordem)

`Permission`: `property:read`, `property:write`, `tenant:read`, `tenant:write`, `lease:read`, `lease:write`, `payment:read`, `payment:write`, `expense:read`, `expense:write`, `member:invite`, `member:manage`, `branch:manage`, `org:read`, `org:update`

## Rota

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v2/me/roles | roles do usuário autenticado |

## Service

| Método | Comportamento |
|---|---|
| `AssignRole` | Verifica duplicata antes de criar — retorna `ErrRoleAlreadyExists` |
| `RemoveRole` | Verifica existência antes de remover — retorna `ErrRoleNotFound` |
| `HasPermission(role, permission)` | Consulta a matriz `permissions[role]` — usada pelo `PermissionMiddleware` |
| `GetPermissionsForRole` | Lista todas as permissions de um role |
| `GetUserRoles` | Lista todos os roles do usuário |

## Middleware

- `PermissionMiddleware(permission)`: extrai `ownerID`/`organizationID`/`role` do contexto (via `pkg/auth`), checa `HasPermission` — 401 sem org, 403 sem permissão. Aplicado em todas as rotas de domínio (GET usa permissions `:read`, POST/PUT/DELETE usam `:write`).
- `RoleMiddleware(svc, roles...)`: exige um dos roles informados; `RoleOwner` sempre passa (bypass hierárquico).

## Gotchas

- Escopo migrou de `property_id` pra `organization_id` + `branch_id` — ver [0002](../../../docs/decisions/rbac/0002-migracao-organization-id.md).
- Middleware em `middleware.go` usa `httputil.Err` e `auth.OwnerIDFromCtx`/`OrganizationIDFromCtx`/`RoleFromCtx` (não `r.Header.Get("Authorization")` direto).

## Decisões

- [0001 - Hierarquia de roles escopada a Property](../../../docs/decisions/rbac/0001-hierarquia-roles-property-scoped.md) (histórico — ver 0002 pra escopo atual)
- [0002 - Migração de domínios para organization_id](../../../docs/decisions/rbac/0002-migracao-organization-id.md)

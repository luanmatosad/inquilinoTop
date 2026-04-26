# rbac — Controle de Acesso por Papel

Gerencia roles de usuários, opcionalmente escopadas a uma Property.

## Modelo

`UserRole`: id, user_id, role (owner|admin|viewer), property_id? (nil = global), created_at

`RoleType`: `owner`, `admin`, `viewer`

## Rota

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v2/me/roles | roles do usuário autenticado |

## Service

| Método | Comportamento |
|---|---|
| `AssignRole` | Verifica duplicata antes de criar — retorna `ErrRoleAlreadyExists` |
| `RemoveRole` | Verifica existência antes de remover — retorna `ErrRoleNotFound` |
| `CheckPermission` | Delega para `HasRole` no repo |
| `GetUserRoles` | Lista todos os roles do usuário |
| `GetUserRolesForProperty` | Lista roles do usuário em property específica |

## Gotchas

- `property_id` nil = role global (não escopado a imóvel).
- RBAC não está integrado como middleware de autorização nas rotas de domínio — é apenas gerenciamento de roles por enquanto.
- Middleware em `middleware.go` usa `httputil.Err` e `auth.OwnerIDFromCtx` (não `r.Header.Get("Authorization")` direto).

# tenant — Inquilinos

CRUD padrão. Todos os campos opcionais exceto `name`.

## Modelo

`Tenant`: id, owner_id, name, email?, phone?, document?, is_active, created_at, updated_at

`CreateTenantInput`: name (obrigatório), email?, phone?, document?

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/tenants | lista (owner) |
| POST | /api/v1/tenants | 201 tenant |
| GET | /api/v1/tenants/{id} | tenant |
| PUT | /api/v1/tenants/{id} | tenant atualizado |
| DELETE | /api/v1/tenants/{id} | `{deleted: true}` |

## Padrão

CRUD padrão com `ownerID` em todas as operações. Soft-delete. Segue o padrão de domínio descrito em `backend/CLAUDE.md`.

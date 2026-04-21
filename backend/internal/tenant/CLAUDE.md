# tenant — Inquilinos

CRUD padrão com validação de `person_type` (PF|PJ). Todos os demais campos opcionais exceto `name`.

## Modelo

`Tenant`: id, owner_id, name, email?, phone?, document?, person_type (PF|PJ), is_active, created_at, updated_at

`CreateTenantInput`: name (obrigatório), person_type (obrigatório: PF|PJ), email?, phone?, document?

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/tenants | lista (owner) |
| POST | /api/v1/tenants | 201 tenant |
| GET | /api/v1/tenants/{id} | tenant |
| PUT | /api/v1/tenants/{id} | tenant atualizado |
| DELETE | /api/v1/tenants/{id} | `{deleted: true}` |

## Gotchas

- `person_type` é obrigatório no body em POST e PUT. Valores aceitos: `PF` (Pessoa Física), `PJ` (Pessoa Jurídica).
- Tenants pré-existentes ao migration 000009 vêm com default `'PF'`.
- Service valida; handler só decodifica.

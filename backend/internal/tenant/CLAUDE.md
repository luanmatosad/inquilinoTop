# tenant — Inquilinos

CRUD padrão com validação de `person_type` (PF|PJ). Todos os demais campos opcionais exceto `name`.

## Modelo

`Tenant`: id, organization_id, name, email?, phone?, document? (só dígitos), person_type (PF|PJ), postal_code? (8 dígitos), address_line?, city?, state? (UF, 2 letras), notes?, is_active, created_at, updated_at

`CreateTenantInput`: name (obrigatório), person_type (obrigatório: PF|PJ), email?, phone?, document?, postal_code?, address_line?, city?, state?, notes?

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
- **Documento**: o service remove a máscara e valida CPF (PF) ou CNPJ (PJ) com `pkg/brdoc`; inválido → `ErrInvalidDocument` → 400 `INVALID_DOCUMENT`. Documento vazio vira `NULL`.
- **Unicidade**: um documento ativo por organização. Service checa com `GetByField`; índice `uq_tenants_org_document_active` cobre a corrida. `ErrDuplicateDocument` (envolve `apierr.ErrConflict`) → 409 `DUPLICATE_DOCUMENT`. Documento de inquilino excluído (`is_active=false`) pode ser reusado.
- **Exclusão**: `Service.WithLeaseChecker(tenant.NewLeaseChecker(db))` bloqueia com `ErrHasActiveLease` → 409 `TENANT_HAS_ACTIVE_LEASE` quando há contrato `ACTIVE`. Sem checker configurado a checagem é ignorada (testes unitários).
- `postal_code` chega sem máscara (validator `len=8,numeric`); a máscara é responsabilidade do frontend.
- PUT substitui todos os campos: o que não vier no body é limpo.

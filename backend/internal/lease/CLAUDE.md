# lease — Contratos de Locação

CRUD padrão + operações de negócio: `End`, `Renew`, `Readjust`. Vincula Tenant ↔ Unit.

## Modelo

`Lease`: id, owner_id, unit_id, tenant_id, start_date, end_date?, rent_amount, deposit_amount?, status (ACTIVE|ENDED|CANCELED), is_active, late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount?, iptu_year?

Inputs:
- `CreateLeaseInput`: unit_id, tenant_id, start_date, end_date?, rent_amount, deposit_amount?, late_fee_percent?, daily_interest_percent?, iptu_reimbursable?, annual_iptu_amount?, iptu_year?
- `UpdateLeaseInput`: end_date?, rent_amount, deposit_amount?, status, late_fee_percent?, daily_interest_percent?, iptu_reimbursable?, annual_iptu_amount?, iptu_year?
- `RenewLeaseInput`: new_end_date, rent_amount
- `ReadjustInput`: percentage (0, 1], index_name?, applied_at, notes?

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/leases | lista (owner) |
| POST | /api/v1/leases | 201 lease |
| GET | /api/v1/leases/{id} | lease |
| PUT | /api/v1/leases/{id} | lease atualizado |
| DELETE | /api/v1/leases/{id} | `{deleted: true}` |
| POST | /api/v1/leases/{id}/end | encerra (status=ENDED) |
| POST | /api/v1/leases/{id}/renew | renova (atualiza end_date e rent_amount) |
| POST | /api/v1/leases/{id}/readjust | aplica reajuste manual versionado |
| GET | /api/v1/leases/{id}/readjustments | histórico de reajustes |

## Gotchas

- `End` não recebe body — apenas id e ownerID.
- `Renew` pode omitir `rent_amount` (zero value no JSON); service decide se atualiza.
- Deleção é soft-delete (`is_active=false`), distinto de `End` (muda apenas status).
- `Readjust` exige percentage ∈ (0, 1] e lease ACTIVE. Não retroage sobre payments já gerados.

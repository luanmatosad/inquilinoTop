# lease — Contratos de Locação

CRUD padrão + operações de negócio: `End` e `Renew`. Vincula Tenant ↔ Unit.

## Modelo

`Lease`: id, owner_id, unit_id, tenant_id, start_date, end_date?, rent_amount, deposit_amount?, status (ACTIVE|ENDED|CANCELED), is_active

Inputs:
- `CreateLeaseInput`: unit_id, tenant_id, start_date, end_date?, rent_amount, deposit_amount?
- `UpdateLeaseInput`: end_date?, rent_amount, deposit_amount?, status
- `RenewLeaseInput`: new_end_date, rent_amount

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

## Gotchas

- `End` não recebe body — apenas id e ownerID.
- `Renew` pode omitir `rent_amount` (zero value no JSON); service decide se atualiza.
- Deleção é soft-delete (`is_active=false`), distinto de `End` (muda apenas status).

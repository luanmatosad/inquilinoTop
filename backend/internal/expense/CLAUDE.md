# expense — Despesas

Vinculado a Unit (não a Lease). Tem soft-delete. Sem rota GET por ID.

## Modelo

`Expense`: id, owner_id, unit_id, description, amount, due_date, category (ELECTRICITY|WATER|CONDO|TAX|MAINTENANCE|OTHER), is_active

`CreateExpenseInput`: unit_id, description, amount, due_date, category

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/units/{unitId}/expenses | lista por unit |
| POST | /api/v1/units/{unitId}/expenses | 201 expense |
| PUT | /api/v1/expenses/{id} | expense atualizado |
| DELETE | /api/v1/expenses/{id} | `{deleted: true}` |

## Gotchas

- Sem rota GET /expenses/{id} — somente listagem por unit.
- `unitID` vem do path em `create` e é injetado em `CreateExpenseInput.UnitID` no handler.
- Update usa `CreateExpenseInput` (mesmo struct que create) — inclui unit_id, mas o handler não sobrescreve do path.
- Soft-delete via `is_active=false`.

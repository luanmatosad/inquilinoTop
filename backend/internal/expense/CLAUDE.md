# expense — Despesas (contas a pagar)

Vinculado a Unit (não a Lease). Tem soft-delete. Sem rota GET por ID.

## Modelo

`Expense`: id, organization_id, unit_id, description, amount, due_date, category (ELECTRICITY|WATER|CONDO|TAX|MAINTENANCE|OTHER), **status** (PENDING|PAID|LATE), paid_date?, paid_amount?, is_active

- `status` persistido é só `PENDING` ou `PAID` (migration 000040, com CHECK de consistência: PAID exige data e valor, PENDING exige ambos nulos).
- **`LATE` é derivado na leitura**: `PENDING` com `due_date` anterior a hoje (fuso `APP_TIMEZONE`, via `WithLocation`). Nunca é gravado.

`CreateExpenseInput`: unit_id (do path), description, amount, due_date, category
`PayExpenseInput`: paid_date (obrigatório), paid_amount? (padrão = amount, arredondado a 2 casas, > 0)

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/expenses?status=&from=&to=&unit_id= | lista da organização (`[]` se vazia) |
| GET | /api/v1/expenses/summary?from=&to=&unit_id= | `{to_pay, overdue, paid}` com `{count, total}` |
| GET | /api/v1/units/{unitId}/expenses | lista por unit |
| POST | /api/v1/units/{unitId}/expenses | 201 expense |
| PUT | /api/v1/expenses/{id} | expense atualizado |
| POST | /api/v1/expenses/{id}/pay | dá baixa |
| POST | /api/v1/expenses/{id}/unpay | estorna a baixa |
| DELETE | /api/v1/expenses/{id} | `{deleted: true}` |

## Regras

- **Filtro `status`**: `PENDING` = a vencer (vence hoje ainda conta), `LATE` = pendente vencida, `PAID`. `from`/`to` filtram o vencimento, inclusive nas pontas. Tudo em SQL, sempre com `organization_id`.
- **Resumo**: ignora `status`; `paid.total` soma o valor efetivamente pago.
- **Baixa** de despesa já paga → 409 `EXPENSE_ALREADY_PAID`; **estorno** de pendente → 409 `EXPENSE_NOT_PAID`. Ambos gravam auditoria (`expense:pay`, `expense:unpay`) via `WithAuditor`.
- **Despesa paga é travada**: `PUT` que muda `amount` ou `due_date` → 409 `EXPENSE_LOCKED`; descrição e categoria podem mudar.
- `Create` recebe `userID` e `orgID`: `owner_id` é o usuário (FK para `users`), não a organização.

## Gotchas

- `unitID` vem do path em `create` e é injetado em `CreateExpenseInput.UnitID` no handler.
- Update usa `CreateExpenseInput` (mesmo struct que create); não muda `unit_id`.
- Soft-delete via `is_active=false`.
- Despesas anteriores à migration 000040 ficam `PENDING` (e vencidas, se for o caso) até serem baixadas.

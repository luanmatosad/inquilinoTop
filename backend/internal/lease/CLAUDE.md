# lease — Contratos de Locação

CRUD padrão + operações de negócio: `End`, `Renew`, `Readjust`. Vincula Tenant ↔ Unit.

## Modelo

`Lease`: id, owner_id, unit_id, tenant_id, start_date, end_date?, rent_amount, deposit_amount?, **payment_day** (1–31), status (ACTIVE|ENDED|CANCELED), is_active, late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount?, iptu_year?, notes? (até 2000)

Inputs:
- `CreateLeaseInput`: unit_id, tenant_id, start_date, end_date?, notes?, generate_payments?, rent_amount, deposit_amount?, late_fee_percent?, daily_interest_percent?, iptu_reimbursable?, annual_iptu_amount?, iptu_year?
- `UpdateLeaseInput`: end_date?, rent_amount, deposit_amount?, status? (se enviado, igual ao atual), notes?, late_fee_percent?, daily_interest_percent?, iptu_reimbursable?, annual_iptu_amount?, iptu_year?
- `RenewLeaseInput`: new_end_date, rent_amount
- `ReadjustInput`: percentage (0, 1], index_name?, applied_at, notes?

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/leases | lista (owner) |
| POST | /api/v1/leases | 201 lease + `payments_generated` (`payments_error` se a geração falhar) |
| GET | /api/v1/leases/{id} | lease |
| PUT | /api/v1/leases/{id} | lease atualizado |
| DELETE | /api/v1/leases/{id} | `{deleted: true}` |
| POST | /api/v1/leases/{id}/end | encerra (status=ENDED) + `payments_canceled`, `payments_need_review` |
| POST | /api/v1/leases/{id}/renew | renova (atualiza end_date e rent_amount) |
| POST | /api/v1/leases/{id}/readjust | aplica reajuste manual versionado |
| GET | /api/v1/leases/{id}/readjustments | histórico de reajustes |

## Regras

- **Um contrato ACTIVE por unidade**: service checa `Repository.HasOverlap` (fim nulo = aberto) e a constraint `leases_no_overlap_per_unit` (EXCLUDE gist, migration 000039, exige `btree_gist`) cobre a corrida. Erro `ErrLeaseOverlap` → 409 `LEASE_OVERLAP`.
- `end_date` deve ser posterior a `start_date` e, na renovação, ao fim atual → `ErrInvalidDates` → 422 `INVALID_DATES`.
- Unidade e inquilino precisam existir na organização (`WithRefs`) → 404 `UNIT_NOT_FOUND` / `TENANT_NOT_FOUND`.
- `Update` não muda status (→ 409 `STATUS_CHANGE_NOT_ALLOWED`); só `End` e `Renew`. `End` e `Renew` exigem contrato ACTIVE (→ 409 `LEASE_NOT_ACTIVE`).
- `generate_payments=true` gera uma cobrança `RENT` por competência até `end_date`, no máximo 12 (`MaxInitialPayments`). A geração seguinte **não existe** (o scheduler é um stub): para contrato aberto, gerar manualmente via `POST /leases/{id}/payments/generate`.
- Encerrar chama `PaymentHooks.CancelFuturePending` (ADR payment-0003). Falha ali não desfaz o encerramento.
- Dependências por interface: `UnitReader`, `TenantReader`, `PaymentHooks`; ligadas em `cmd/api/main.go` com `WithRefs` e `WithPayments`.

## Gotchas

- `End` não recebe body — apenas id e ownerID. Nunca estende `end_date`: usa o menor entre o fim atual e hoje.
- `Renew` pode omitir `rent_amount` (zero value no JSON); service decide se atualiza.
- Deleção é soft-delete (`is_active=false`), distinto de `End` (muda apenas status).
- `Readjust` exige percentage ∈ (0, 1] e lease ACTIVE. Não retroage sobre payments já gerados.
- `payment_day` (migration 000017): obrigatório em `CreateLeaseInput` (1–31), usado como dia de vencimento por `payment.GenerateMonth`.
- `scheduler.go`: stub (só registra log); **não** gera pagamentos.
- `index_repository.go`: repositório para tabela `index_values` (IGPM, IPCA etc.) — consumido em `Readjust`.
- `errors.Is` (não `strings.Contains`) para roteamento de erros (corrigido em `fix/payment,lease` commit).

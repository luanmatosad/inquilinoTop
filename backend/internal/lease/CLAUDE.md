# lease — Contratos de Locação

CRUD padrão + operações de negócio: `End`, `Renew`, `Readjust`. Vincula Tenant ↔ Unit.

## Modelo

`Lease`: id, owner_id, unit_id, tenant_id, start_date, end_date?, rent_amount, deposit_amount?, **payment_day** (1–31), status (ACTIVE|ENDED|CANCELED), is_active, late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount?, iptu_year?, notes? (até 2000), **adjustment_index?** (IGP-M\|IPCA), **adjustment_month?** (1–12, padrão o mês de `start_date`), **end_reason?** (só depois de encerrar), **next_readjustment?** (calculado, dia 1)

Inputs:
- `CreateLeaseInput`: unit_id, tenant_id, start_date, end_date?, notes?, generate_payments?, adjustment_index?, adjustment_month?, rent_amount, deposit_amount?, late_fee_percent?, daily_interest_percent?, iptu_reimbursable?, annual_iptu_amount?, iptu_year?
- `UpdateLeaseInput`: adjustment_index?, adjustment_month?, end_date?, rent_amount, deposit_amount?, status? (se enviado, igual ao atual), notes?, late_fee_percent?, daily_interest_percent?, iptu_reimbursable?, annual_iptu_amount?, iptu_year?
- `RenewLeaseInput`: new_end_date, rent_amount
- `EndLeaseInput` (corpo opcional de `/end`): end_date?, reason?
- `ReadjustInput`: percentage (0, 1], index_name?, applied_at, notes?

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/leases | lista (owner) |
| POST | /api/v1/leases | 201 lease + `payments_generated` (`payments_error` se a geração falhar) |
| GET | /api/v1/leases/{id} | lease |
| PUT | /api/v1/leases/{id} | lease atualizado |
| DELETE | /api/v1/leases/{id} | `{deleted: true}` |
| POST | /api/v1/leases/{id}/end | encerra (status=ENDED). Corpo **opcional** `{end_date, reason}` (`end_date` em YYYY-MM-DD ou RFC3339; `reason` ∈ TERM_END, TENANT_REQUEST, NONPAYMENT, OWNER_REQUEST, OTHER) + `payments_canceled`, `payments_need_review` |
| POST | /api/v1/leases/{id}/renew | renova (atualiza end_date e rent_amount) |
| POST | /api/v1/leases/{id}/readjust | aplica reajuste manual versionado e atualiza as cobranças RENT futuras pendentes sem cobrança emitida (`payments_updated`, `payments_need_review`, `payments_error`) |
| GET | /api/v1/leases/{id}/readjustments | histórico de reajustes |

## Regras

- **Um contrato ACTIVE por unidade**: service checa `Repository.HasOverlap` (fim nulo = aberto) e a constraint `leases_no_overlap_per_unit` (EXCLUDE gist, migration 000039, exige `btree_gist`) cobre a corrida. Erro `ErrLeaseOverlap` → 409 `LEASE_OVERLAP`.
- `end_date` deve ser posterior a `start_date` e, na renovação, ao fim atual → `ErrInvalidDates` → 422 `INVALID_DATES`.
- Unidade e inquilino precisam existir na organização (`WithRefs`) → 404 `UNIT_NOT_FOUND` / `TENANT_NOT_FOUND`.
- `Update` não muda status (→ 409 `STATUS_CHANGE_NOT_ALLOWED`); só `End` e `Renew`. `End` e `Renew` exigem contrato ACTIVE (→ 409 `LEASE_NOT_ACTIVE`).
- `generate_payments=true` gera uma cobrança `RENT` por competência até `end_date`, no máximo 12 (`MaxInitialPayments`). A geração seguinte **não existe** (o scheduler é um stub): para contrato aberto, gerar manualmente via `POST /leases/{id}/payments/generate`.
- Encerrar chama `PaymentHooks.CancelFuturePending` (ADR payment-0003) a partir da **data de saída efetiva**. Falha ali não desfaz o encerramento.
- Reajustar chama `PaymentHooks.ReadjustFuturePending` (ADR payment-0004): atualiza o `gross_amount` das `RENT` `PENDING` sem `charge_id` com vencimento a partir da vigência. Falha ali não desfaz o reajuste do contrato. O reajuste automático (`/adjust`) usa o mesmo caminho.
- `next_readjustment` (`NextReadjustment`): sem reajuste aplicado, o primeiro mês de reajuste 12+ meses depois do início; com reajuste, o ciclo mais próximo da data aplicada + 12 meses. O `leaseCols` traz o último `applied_at` por subconsulta (sem N+1).
- Dependências por interface: `UnitReader`, `TenantReader`, `PaymentHooks`; ligadas em `cmd/api/main.go` com `WithRefs` e `WithPayments`.

## Gotchas

- `End` aceita corpo opcional; sem corpo a saída é hoje. Nunca estende `end_date`: usa o menor entre o fim previsto e a data de saída. Data de saída antes do início → 422.
- `Renew` pode omitir `rent_amount` (zero value no JSON); service decide se atualiza.
- Deleção é soft-delete (`is_active=false`), distinto de `End` (muda apenas status).
- `late_fee_percent` e `daily_interest_percent` são **percentuais** (2 = 2%); `payment.Enrich`/`markPaid` dividem por 100. `Readjust.percentage` é fração (0,05 = 5%).
- `lease_readjustments` é escopada por `organization_id` (migration 000042; `owner_id` virou legado opcional).
- `Readjust` exige percentage ∈ (0, 1] e lease ACTIVE. Atualiza só cobranças futuras pendentes (ver acima); pagas, IPTU e emitidas não mudam.
- `PUT /leases/{id}` é substituição total: `adjustment_index` omitido é limpo; `adjustment_month` omitido mantém o atual.
- `payment_day` (migration 000017): obrigatório em `CreateLeaseInput` (1–31), usado como dia de vencimento por `payment.GenerateMonth`.
- `scheduler.go`: stub (só registra log); **não** gera pagamentos.
- `index_repository.go`: repositório para tabela `index_values` (IGPM, IPCA etc.) — consumido em `Readjust`.
- `errors.Is` (não `strings.Contains`) para roteamento de erros (corrigido em `fix/payment,lease` commit).

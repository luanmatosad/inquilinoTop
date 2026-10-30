# payment — Pagamentos

Vinculado a Lease. Sem Delete (pagamentos são imutáveis); única exceção: `DeactivateFuturePending` (ADR 0003). Suporta cobrança via providers externos.

## Modelo

`Payment`: id, owner_id, lease_id, due_date, paid_date?, gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount?, competency?, description?, status (PENDING|PAID|LATE), type (RENT|DEPOSIT|EXPENSE|OTHER), charge_id?, charge_method?, charge_qrcode?, charge_link?, charge_barcode?, payout_id?, payout_status?, created_at, updated_at

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/payments?status=&from=&to=&lease_id= | lista da organização, com LATE, multa e juros |
| GET | /api/v1/payments/summary?from=&to=&lease_id= | `{to_receive, overdue, paid}` com `{count, total}` |
| GET | /api/v1/leases/{leaseId}/payments | lista por lease |
| POST | /api/v1/leases/{leaseId}/payments | 201 payment |
| GET | /api/v1/payments/{id} | payment |
| PUT | /api/v1/payments/{id} | payment atualizado |
| POST | /api/v1/leases/{leaseId}/payments/generate?month=YYYY-MM | gera RENT + IPTU do mês |
| GET | /api/v1/payments/{id}/receipt | recibo (só se PAID) |
| POST | /api/v1/payments/{id}/charge | cria cobrança no provider (PIX/BOLETO) |
| POST | /api/v1/payments/webhook | recebe webhook do provider |
| GET | /api/v1/financial-config | configuração financeira do owner |
| POST | /api/v1/financial-config | cria/atualiza configuração financeira |
| DELETE | /api/v1/financial-config | soft-delete da configuração |

## Providers de Pagamento (`internal/payment/provider/`)

Interface `PaymentProvider`: `CreatePIXCharge`, `CreateBoletoCharge`, `GetChargeStatus`, `CreatePayout`, `RegisterWebhook`, `GetProviderName`.

Providers implementados: `asaas`, `sicoob`, `bradesco` (com `sync.Mutex` no token cache), `itau`, `mock`.

Factory: `provider.NewProvider(providerType, config)` — string `"asaas"|"sicoob"|"bradesco"|"itau"|"mock"`.

## Interfaces Cruzadas

- `LeaseReader` — evita importar o pacote lease diretamente.
- `TenantReader` — para verificar se tenant é PJ (IRRF).
- `IRRFCalculator` — consumida do pacote `fiscal`.

## Gotchas

- **Filtro `status`**: `PENDING` = a vencer, `LATE` = não paga e vencida, `PAID`; decidido em SQL pela data, não pelo status gravado. `from`/`to` filtram o vencimento, inclusive nas pontas.
- **Resumo**: `overdue` soma o valor atualizado (bruto + multa + juros); `paid` soma o líquido quando existe, senão o bruto. É calculado no service sobre a lista filtrada (adequado ao porte do MVP; paginação futura exigirá agregar em SQL).
- A listagem da organização agora passa por `Enrich` (antes só `Get` e `ListByLease` calculavam LATE/multa/juros).
- `leaseID` vem do path; não vai no body de `CreatePaymentInput`.
- `payments.is_active` (migration 000038): só `lease.End` desativa, via `LeaseHooks.CancelFuturePending` (pendentes futuras sem `charge_id`). Leituras filtram `is_active=true`.
- `LeaseHooks` (`lease_hooks.go`) implementa `lease.PaymentHooks` sem `lease` importar `payment`.
- `GenerateMonth` usa o `payment_day` do contrato para o vencimento (ajustado ao último dia do mês); sem `payment_day`, usa o dia de `start_date`.
- `GenerateMonth` é idempotente por constraint `(lease_id, competency, type)` (migration 000014).
- `Update` com paid_date + status=PAID dispara cálculo de IRRF se RENT + tenant PJ.
- `errors.Is` (não `strings.Contains`) para roteamento de erros no service.
- Handlers de recibo, cobrança, status, repasse e configuração financeira escopam por `OrganizationIDFromCtx`. `OwnerIDFromCtx` é o usuário: só serve para `owner_id`/auditoria e para o locador do recibo (`BuildReceipt(id, orgID, userID)`).
- `late_fee_percent`/`daily_interest_percent` do contrato são percentuais (2 = 2%): multa = bruto × percent / 100.
- `financial_config` é escopada por `organization_id` (migration 000041; `owner_id` virou legado opcional). Uma configuração ativa por organização, garantida por índice único parcial que o upsert usa no `ON CONFLICT`.
- Soft-delete em `DeleteFinancialConfig` (não DELETE real).

## Decisões

- [0001 - Payment imutável (sem Delete)](../../../docs/decisions/payment/0001-payment-imutavel-sem-delete.md)
- [0002 - Abstração multi-provider (PaymentProvider)](../../../docs/decisions/payment/0002-abstracao-multi-provider.md)
- [0003 - Cancelamento de futuras pendentes ao encerrar contrato](../../../docs/decisions/payment/0003-cancelamento-de-futuras-pendentes-ao-encerrar-contrato.md)

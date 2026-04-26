# payment — Pagamentos

Vinculado a Lease. Sem Delete (pagamentos são imutáveis). Suporta cobrança via providers externos.

## Modelo

`Payment`: id, owner_id, lease_id, due_date, paid_date?, gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount?, competency?, description?, status (PENDING|PAID|LATE), type (RENT|DEPOSIT|EXPENSE|OTHER), charge_id?, charge_method?, charge_qrcode?, charge_link?, charge_barcode?, payout_id?, payout_status?, created_at, updated_at

## Rotas

| Método | Rota | Retorna |
|---|---|---|
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

- `leaseID` vem do path; não vai no body de `CreatePaymentInput`.
- `GenerateMonth` é idempotente por constraint `(lease_id, competency, type)` (migration 000014).
- `Update` com paid_date + status=PAID dispara cálculo de IRRF se RENT + tenant PJ.
- `errors.Is` (não `strings.Contains`) para roteamento de erros no service.
- Soft-delete em `DeleteFinancialConfig` (não DELETE real).

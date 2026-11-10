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
| GET | /api/v1/payments/{id}/receipt | recibo numerado (só se PAID): `number` 0001/2026, forma, desconto |
| GET | /api/v1/payments/{id}/events | linha do tempo: Criada, eventos gravados (SENT, REMINDER, AGREEMENT, REPORTED, REJECTED, PAID) e Venceu em |
| POST | /api/v1/payments/{id}/events | registra envio: `kind` SENT\|REMINDER, `channel` WHATSAPP\|EMAIL\|COPY (409 se paga) |
| GET | /api/v1/payments/{id}/pix | Pix copia-e-cola estático com o valor atualizado do dia (422 `PIX_KEY_NOT_CONFIGURED`, 409 se paga) |
| POST | /api/v1/payments/{id}/link | cria (ou **rotaciona**, revogando o anterior) o link público; devolve `{url, expires_at}` uma única vez (422 `PUBLIC_URL_NOT_CONFIGURED`) |
| GET | /api/v1/payments/{id}/proof | comprovante do aviso do inquilino (só o dono, escopado à organização) |
| POST | /api/v1/payments/{id}/confirm-report | baixa pelo aviso: Pix, data informada, `discount`/`note` opcionais (409 `NO_PENDING_REPORT`) |
| POST | /api/v1/payments/{id}/reject-report | "ainda não recebi": limpa o aviso, apaga o comprovante, evento `REJECTED` |
| GET | /api/v1/public/payments/{token}, `/pix`, `/receipt` | **sem login**; ver Link público |
| POST | /api/v1/public/payments/{token}/report | "já paguei": multipart `amount`, `paid_date`, `proof?` |
| POST | /api/v1/payments/{id}/agreement | acordo de atraso: `new_due_date` (> hoje), `agreed_amount?`, `note?` |
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

- **Baixa estendida (000049):** `PUT /payments/{id}` com `status=PAID` aceita `payment_method` (PIX, CASH, TRANSFER, BOLETO, OTHER), `discount_amount` e `payment_note`. Líquido = bruto + multa + juros − desconto − IRRF; a base do IRRF é o valor devido menos o desconto. Desconto maior que o devido → 400 `INVALID_DISCOUNT`. `Repository.MarkPaid(PaidInput)` roda numa transação: grava a baixa, tira o número do recibo e registra o evento `PAID`.
- **Recibo numerado:** `receipt_counters (organization_id, year)` com `INSERT … ON CONFLICT … last_number+1` na mesma transação; índice único parcial `(organization_id, receipt_year, receipt_number)`. Cobranças pagas antes da numeração recebem o número na primeira emissão (`EnsureReceiptNumber`). O ano é o do `paid_date`.
- **Eventos (`EventStore`):** interface separada, ligada com `WithEvents(payment.NewEventStore(db))`. Imutáveis (sem edição nem exclusão). `Timeline` soma os marcos calculados CREATED e OVERDUE aos gravados.
- **Acordo:** troca `due_date` e `gross_amount` (padrão: total de hoje com multa e juros), preserva o vencimento original em `original_due_date` (só na primeira vez) e grava `AGREEMENT` com os valores anteriores. Recusa cobrança paga (409) e com `charge_id` (409 `PAYMENT_HAS_CHARGE`). Se a nova data passar sem pagamento, volta a `LATE` com multa e juros contados da nova data (o valor combinado já inclui a multa anterior).
- **Conta Pix da cobrança:** `PixPayload` escolhe pela unidade do contrato (`PixAccountReader`, ligado em `main.go` ao módulo `settings`): conta da unidade, senão a da organização, senão a chave antiga de `financial_config.pix_key`. Nome e cidade da conta escolhida; vazios, o nome do perfil e a cidade do imóvel. **Se escolher a conta falhar, o erro sobe** (não cai na chave da organização: o dinheiro poderia ir para a conta errada). A resposta (`PixCode`) e a pública trazem `receiver_name`, o nome como entra no código (`pix.ReceiverName`), para o pagador ver para quem paga.
- **Pix estático:** `pkg/pix` gera o BR Code (campos 00, 26, 52, 53, 54, 58, 59, 60, 62, CRC16-CCITT). Nome do recebedor vem do perfil (`OwnerReaderAdapter` usa `full_name`, com e-mail como último recurso); cidade, do imóvel (`BRASIL` se faltar). Valide o código num app bancário antes de depender dele.

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

## Link público e aviso do inquilino (000050)

- **Token:** 32 bytes de `crypto/rand` em base64url; o banco guarda só o SHA-256 (`payment_links.token_hash`). Um link ativo por cobrança (índice único parcial); `RotateLink` revoga o anterior numa transação. Token inexistente, revogado ou expirado dá o mesmo 404 `NOT_FOUND`.
- **Validade:** `expires_at` = vencimento + 90 dias (mínimo hoje + 30), calculada na leitura como o maior entre o gravado, vencimento + 90 e, se paga, pagamento + 365 (acordo e pagamento estendem sem escrever).
- **Exposição mínima (`PublicView`):** nome do locador, valor do dia, vencimento, rótulo da unidade, competência, situação, data e número do recibo. O recibo público vem sem documentos nem endereço.
- **Aviso:** colunas `reported_at/amount/date` e `proof_path`; **"Aguardando confirmação" é derivada** (`awaiting_confirmation` = não paga com `reported_at`), `status` não muda. `SaveReport`/`ClearReport` gravam a coluna e o evento `REPORTED`/`REJECTED` na mesma transação. Novo aviso substitui o anterior e apaga o comprovante antigo.
- **Comprovante:** até 5 MB, JPEG/PNG/PDF detectado por `http.DetectContentType` (nunca pelo nome), extensão vem do tipo, gravado em `ProofStorage` (`document.Storage`) sob a organização; nunca servido por rota pública.
- **Limites** (`Handler.RegisterPublic`): 30 req/min por IP e 5 avisos/hora por link (`ratelimit.New`); o IP segue `X-Forwarded-For`/`X-Real-IP` como o middleware global, então atrás de proxy não confiável o limite por IP pode ser contornado (o limite por link continua valendo). Respostas com `Cache-Control: no-store`.
- `REPORTED` e `REJECTED` só o sistema grava: `POST /events` continua aceitando apenas `SENT`/`REMINDER`.

## Decisões

- [0001 - Payment imutável (sem Delete)](../../../docs/decisions/payment/0001-payment-imutavel-sem-delete.md)
- [0002 - Abstração multi-provider (PaymentProvider)](../../../docs/decisions/payment/0002-abstracao-multi-provider.md)
- [0003 - Cancelamento de futuras pendentes ao encerrar contrato](../../../docs/decisions/payment/0003-cancelamento-de-futuras-pendentes-ao-encerrar-contrato.md)

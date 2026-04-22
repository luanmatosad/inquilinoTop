# Financial Provider Integration — Design

**Date:** 2026-04-22  
**Status:** Approved

## 1. Overview

Módulo de integração com prestadores de serviços financeiros (providers) para processar cobranças PIX/boleto e transferências (payouts). Suporta múltiplos providers com interface unificada via Adapter Pattern.

**Providers:**
- Asaas (completo)
- Sicoob (PIX + boleto via API BACEN)
- Bradesco (PIX + boleto via API BACEN)
- Itaú (PIX + boleto via API BACEN)

## 2. Arquitetura

```
backend/internal/payment/provider/
├── provider.go      # interface PaymentProvider
├── asaas.go          # implementação Asaas
├── sicoob.go        # implementação Sicoob
├── bradesco.go      # implementação Bradesco
├── itau.go          # implementação Itaú
└── mock.go          # implementação mock para testes
```

**Adapter Pattern:**
- Interface única abstrai diferenças entre providers
- Cada adapter traduz chamada unificada para API específica
- Configuração determina qual provider usar

## 3. Interface

```go
type PaymentProvider interface {
    // Charge (recebimento)
    CreatePIXCharge(ctx context.Context, req PIXChargeRequest) (*ChargeResponse, error)
    CreateBoletoCharge(ctx context.Context, req BoletoChargeRequest) (*ChargeResponse, error)
    GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error)
    
    // Payout (transferência)
    CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error)
    
    // Webhook
    RegisterWebhook(ctx context.Context, url string, events []string) error
}
```

### 3.1 Request/Response Types

```go
type PIXChargeRequest struct {
    Amount       float64
    Currency     string  // default: "BRL"
    DueDate      *time.Time
    Customer    Customer
    Reference   string   // external_id para conciliacao
    Description string
}

type BoletoChargeRequest struct {
    Amount       float64
    Currency     string
    DueDate      *time.Time
    Customer    Customer
    Reference   string
    Description string
}

type Customer struct {
    Name     string
    Document string  // CPF ou CNPJ
    Email    string
}

type ChargeResponse struct {
    ChargeID    string     // ID no provider
    Status      string     // PENDING, PAID, EXPIRED, CANCELED
    QRCode      string     // base64 ou URL para QR
    QRLink     string     // link de pagamento
    BarCode    string     // código de barras (boleto)
    PixCopiaCola string   // string copy-paste PIX
    ExpiresAt   *time.Time
    PaidAt     *time.Time
}

type ChargeStatus struct {
    ChargeID string
    Status   string
    PaidAt   *time.Time
    Amount   float64
}

type PayoutRequest struct {
    Amount        float64
    Currency      string
    Destination   Destination
    Reference     string
    ScheduleDate *time.Time
}

type Destination struct {
    Type         string  // PIX, TED
    PixKey       string
    PixKeyType   string  // CPF, CNPJ, EMAIL, PHONE, EVP
    BankCode     string  // for TED
    Agency       string
    Account     string
    AccountType string  // CHECKING, SAVINGS
    OwnerName   string
    Document   string
}

type PayoutResponse struct {
    PayoutID   string
    Status     string  // PENDING, DONE, CANCELLED
    CreatedAt  time.Time
    ArrivalDate *time.Time
}

type PIXChargeRequest = ChargeRequest
type BoletoChargeRequest = ChargeRequest
```

## 4. Provider Implementations

### 4.1 Asaas

**APIs utilizadas:**
- POST /v3/charges (cobrança com PIX)
- POST /v3/charges (boleto)
- GET /v3/charges/{id}
- POST /v3/transfers (payout via PIX/chave)
- POST /v3/webhooks

**Status suportados:** `PENDING`, `CONFIRMED`, `RECEIVED`, `OVERDUE`, `CANCELLED`

**Configuração:**
```json
{
  "provider": "asaas",
  "api_key": "${ASAAS_API_KEY}",
  "environment": "sandbox", // ou production
  "wallet_id": "${ASAAS_WALLET_ID}"
}
```

### 4.2 Sicoob

**APIs utilizadas:**
- API PIX Cobrança (BACEN padronizada)
- Cobrança com vencimento
- Webhook PIX

**Status suportados:** `ATIVA`, `PAGA`, `BAIXA`, `EXPIRADA`

**Configuração:**
```json
{
  "provider": "sicoob",
  "client_id": "${SICOOB_CLIENT_ID}",
  "client_secret": "${SICOOB_CLIENT_SECRET}",
  "certificate_path": "${SICOOB_CERT_PATH}",
  "pix_key": "${SICOOB_PIX_KEY}",
  "cooperative": "${SICOOB_COOPERATIVE}"
}
```

**Nota:** Payout via Sicoob requer API adicional (Conta Corrente). Implementação futura.

### 4.3 Bradesco

**APIs utilizadas:**
- API PIX Bradesco (BACEN padronizada)
- Cobrança com vencimento

**Configuração:**
```json
{
  "provider": "bradesco",
  "client_id": "${BRADESCO_CLIENT_ID}",
  "client_secret": "${BRADESCO_CLIENT_SECRET}",
  "certificate_path": "${BRADESCO_CERT_PATH}",
  "pix_key": "${BRADESCO_PIX_KEY}"
}
```

### 4.4 Itaú

**APIs utilizadas:**
- API Itaú Developers (BACEN padronizada)
- mastria SDK (opcional)

**Configuração:**
```json
{
  "provider": "itau",
  "client_id": "${ITAU_CLIENT_ID}",
  "access_token": "${ITAU_ACCESS_TOKEN}",
  "certificate_path": "${ITAU_CERT_PATH}",
  "pix_key": "${ITAU_PIX_KEY}"
}
```

## 5. Fluxo

### 5.1 Cobrança (Charge)

```
1. Frontend → POST /api/v1/payments/{id}/charge
   Body: { "method": "PIX" | "BOLETO" }

2. Handler → Service.CreateCharge(paymentID, method)

3. Service → PaymentProvider.Create{PIX|Boleto}Charge()

4. Provider retorna: qrCode, link, barCode, status

5. Service → PaymentRepository.UpdateChargeInfo(paymentID,ChargeResponse)

6. HTTP 200 → { data: { qrCode, link, barCode, expiresAt } }
```

### 5.2 Webhook (notificação de pagamento)

```
1. Provider → POST /webhook/{provider}
   Body: { event, chargeID, status, paidAt }

2. Handler identifica provider via path

3. Service.ProcessWebhook(event, chargeID)

4. Se event = PAYMENT_RECEIVED:
   a. Busca Payment por reference (external_payment_id)
   b. Atualiza status = PAID
   c. PaidDate = now
   d. Recalcula IRRF se aplicável
   e. Dispara cálculo de taxa administrativa

5. HTTP 200 → OK
```

### 5.3 Payout (transferência)

```
1. Frontend → POST /api/v1/payments/{id}/payout
   Body: { "destination": {...} }

2. Handler → Service.CreatePayout(paymentID, destination)

3. Service → PaymentProvider.CreatePayout()

4. Provider retorna: payoutID, status

5. Service → PaymentRepository.UpdatePayoutInfo(paymentID, payoutResponse)

6. HTTP 200 → { data: { payoutID, status, arrivalDate } }
```

## 6. Dados

### 6.1 Tabela financial_config

```sql
CREATE TABLE financial_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(20) NOT NULL, -- asaas, sicoob, bradesco, itau
    config JSONB NOT NULL, -- credenciais por provider
    pix_key VARCHAR(77),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_financial_config_owner ON financial_config(owner_id);
```

### 6.2 Campos em Payment

```sql
ALTER TABLE payments ADD COLUMN charge_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN charge_method VARCHAR(10); -- PIX, BOLETO
ALTER TABLE payments ADD COLUMN charge_qrcode TEXT;
ALTER TABLE payments ADD COLUMN charge_link TEXT;
ALTER TABLE payments ADD COLUMN charge_barcode TEXT;
ALTER TABLE payments ADD COLUMN payout_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN payout_status VARCHAR(20);
ALTER TABLE payments ADD COLUMN financial_config_id UUID REFERENCES financial_config(id);
```

## 7. Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/v1/payments/{id}/charge | Cria电荷 (PIX/boleto) |
| POST | /api/v1/payments/{id}/payout | Cria transferencia |
| POST | /webhook/{provider} | Webhook do provider |
| GET | /api/v1/payments/{id}/charge | Status da电荷 |

## 8. Configuração por Ambiente

```yaml
# config.yaml
providers:
  asaas:
    api_key: "${ASAAS_API_KEY}"
    environment: sandbox
  
  sicoob:
    client_id: "${SICOOB_CLIENT_ID}"
    client_secret: "${SICOOB_CLIENT_SECRET}"
    certificate_path: "./certs/sicoob.p12"
    pix_key: "${SICOOB_PIX_KEY}"
  
  bradesco:
    client_id: "${BRADESCO_CLIENT_ID}"
    client_secret: "${BRADESCO_CLIENT_SECRET}"
    certificate_path: "./certs/bradesco.p12"
    pix_key: "${BRADESCO_PIX_KEY}"
  
  itau:
    client_id: "${ITAU_CLIENT_ID}"
    access_token: "${ITAU_ACCESS_TOKEN}"
    certificate_path: "./certs/itau.p12"
    pix_key: "${ITAU_PIX_KEY}"
```

## 9. Testes

### 9.1 Unit Tests

- Cada provider implementa interface corretamente
- Tradução de request/response
- tratamento de erros

### 9.2 Integration Tests

- requires Docker (make test-backend-integration)
- Mocks de API para cada provider

### 9.3 Mock Provider

- Implementação em memória para testes sem rede
- Respostas determinísticas

## 10. Considerações

- **Idempotência:** Cria电荷 com reference único para evitar duplicatas
- **Concorrência:** Webhook pode chegar fora de ordem — usar idempotency key
- **Segurança:** Credenciais nunca em logs; certificados em volume separado
- **Taxa administrativa:** Calcular antes de payout; descontar do valor líquido
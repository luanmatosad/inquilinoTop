# Núcleo Fiscal do Ciclo de Aluguel — Design

**Data:** 2026-04-20
**Status:** Aprovado para implementação
**Escopo:** Backend Go (`backend/`) — ciclo fiscal/legal de locação residencial, owner pessoa física.

## 1. Objetivo

Entregar o núcleo fiscal e legal do ciclo mensal de aluguel para o locador pessoa física: geração mensal de cobranças, cálculo de multa e juros por atraso, retenção de IRRF quando locatário é pessoa jurídica, IPTU repassável ao locatário, reajuste contratual versionado, recibo mensal conforme Lei 8.245/91 art. 22 IV e relatório fiscal anual para apoio à DIRPF.

## 2. Escopo

### Dentro
- Perfil: locador PF; locatário PF ou PJ.
- Reajuste manual versionado (percentual informado pelo usuário).
- Multa moratória e juros de mora configuráveis por contrato; cálculo automático.
- IPTU com opção de repasse ao locatário, gerando cobrança mensal rateada.
- Geração mensal de payments via endpoint idempotente.
- Retenção de IRRF em aluguel pago por PJ (base: tabela progressiva mensal, DARF 3208, IN RFB 1.500/2014).
- Recibo mensal (JSON) com base legal citada.
- Relatório fiscal anual agregado por lease para DIRPF.

### Fora
- Boletos CNAB e PIX Bacen.
- Conciliação bancária automática.
- Comissão de corretagem, repasse a proprietários (owner é o proprietário).
- NFS-e, DIMOB, DARF impresso.
- Rateio de condomínio, KPIs/dashboards.
- Cobranças de venda de imóvel.

## 3. Arquitetura

Abordagem híbrida: estende os módulos existentes onde a regra é natural, cria módulo novo apenas para agregação transversal.

### 3.1 Extensões em módulos existentes

| Módulo | Mudança |
|---|---|
| `tenant` | Campo `person_type` (PF|PJ) obrigatório |
| `lease` | Campos `late_fee_percent`, `daily_interest_percent`, `iptu_reimbursable`, `annual_iptu_amount`, `iptu_year`; endpoints `POST /leases/{id}/readjust`, `GET /leases/{id}/readjustments` |
| `payment` | Renomeia `amount` para `gross_amount`; adiciona `late_fee_amount`, `interest_amount`, `irrf_amount`, `net_amount`, `competency`, `description`; endpoints `POST /leases/{id}/payments/generate`, `GET /payments/{id}/receipt` |
| `expense` | Sem mudança estrutural |

### 3.2 Novo módulo `internal/fiscal/`

Responsabilidade única: agregação transversal para relatório fiscal anual e encapsulamento da tabela IRRF (lida pelo `payment.Service` para retenção).

- `model.go` — tipos do relatório, interface `IRRFTable`.
- `repository.go` — queries agregadas e leitura de `irrf_brackets`.
- `service.go` — regras de agregação.
- `handler.go` — `GET /api/v1/fiscal/annual-report?year=YYYY`.

### 3.3 Dependências cruzadas

- `payment.Service` depende de `lease.Repository` e `tenant.Repository` (para ler regras fiscais do lease e `person_type` do tenant no momento do cálculo).
- `payment.Service` depende de `fiscal.IRRFTable` (cálculo da retenção).
- `fiscal.Service` lê de `payment`, `expense`, `lease`, `tenant`.

Composição única em `cmd/api/main.go`.

## 4. Modelo de Dados

### 4.1 Migrations novas

**000009** — `tenants.person_type`
```sql
ALTER TABLE tenants
  ADD COLUMN person_type TEXT NOT NULL DEFAULT 'PF'
    CHECK (person_type IN ('PF','PJ'));
```
Default aplica a rows existentes; input passa a exigir explicitamente.

**000010** — `leases` (campos fiscais)
```sql
ALTER TABLE leases
  ADD COLUMN late_fee_percent       NUMERIC(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN daily_interest_percent NUMERIC(8,6) NOT NULL DEFAULT 0,
  ADD COLUMN iptu_reimbursable      BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN annual_iptu_amount     NUMERIC(14,2),
  ADD COLUMN iptu_year              INT;
```

**000011** — `payments` (decomposição monetária)
```sql
ALTER TABLE payments RENAME COLUMN amount TO gross_amount;
ALTER TABLE payments
  ADD COLUMN late_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN interest_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN irrf_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN net_amount      NUMERIC(14,2),
  ADD COLUMN competency      CHAR(7),
  ADD COLUMN description     TEXT;
CREATE UNIQUE INDEX ux_payments_lease_competency_type
  ON payments(lease_id, competency, type) WHERE competency IS NOT NULL;
```

**000012** — `lease_readjustments`
```sql
CREATE TABLE lease_readjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id      UUID NOT NULL REFERENCES leases(id),
  owner_id      UUID NOT NULL,
  applied_at    DATE NOT NULL,
  old_amount    NUMERIC(14,2) NOT NULL,
  new_amount    NUMERIC(14,2) NOT NULL,
  percentage    NUMERIC(7,4) NOT NULL,
  index_name    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ix_readjustments_lease ON lease_readjustments(lease_id);
```

**000013** — `irrf_brackets`
```sql
CREATE TABLE irrf_brackets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valid_from DATE NOT NULL,
  min_base   NUMERIC(14,2) NOT NULL,
  max_base   NUMERIC(14,2),
  rate       NUMERIC(5,4) NOT NULL,
  deduction  NUMERIC(14,2) NOT NULL DEFAULT 0
);
```
Seed com tabela vigente na data da implantação. Atualização futura via nova linha com `valid_from` posterior (sem código novo).

Todas as migrations são reversíveis (up/down).

### 4.2 Reflexo nos models Go

```go
// tenant
type Tenant struct {
    // ... campos atuais ...
    PersonType string `json:"person_type"` // "PF" | "PJ"
}

// lease
type Lease struct {
    // ... campos atuais ...
    LateFeePercent       float64  `json:"late_fee_percent"`
    DailyInterestPercent float64  `json:"daily_interest_percent"`
    IPTUReimbursable     bool     `json:"iptu_reimbursable"`
    AnnualIPTUAmount     *float64 `json:"annual_iptu_amount,omitempty"`
    IPTUYear             *int     `json:"iptu_year,omitempty"`
}

type Readjustment struct {
    ID         uuid.UUID `json:"id"`
    LeaseID    uuid.UUID `json:"lease_id"`
    OwnerID    uuid.UUID `json:"owner_id"`
    AppliedAt  time.Time `json:"applied_at"`
    OldAmount  float64   `json:"old_amount"`
    NewAmount  float64   `json:"new_amount"`
    Percentage float64   `json:"percentage"`
    IndexName  *string   `json:"index_name,omitempty"`
    Notes      *string   `json:"notes,omitempty"`
    CreatedAt  time.Time `json:"created_at"`
}

// payment
type Payment struct {
    ID, OwnerID, LeaseID uuid.UUID
    DueDate              time.Time
    PaidDate             *time.Time
    GrossAmount          float64
    LateFeeAmount        float64
    InterestAmount       float64
    IRRFAmount           float64
    NetAmount            *float64
    Competency           *string // "YYYY-MM"
    Description          *string
    Status, Type         string
    CreatedAt, UpdatedAt time.Time
}

// fiscal
type IRRFTable interface {
    Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}
```

Valores monetários continuam `float64` para consistência com o resto do projeto. Arredondamento obrigatório a cada cálculo antes de persistir (`math.Round(x*100)/100`). Migração para tipo decimal é tech-debt fora desta spec.

## 5. Regras de Negócio

### 5.1 Geração mensal de payments

Endpoint: `POST /api/v1/leases/{id}/payments/generate?month=YYYY-MM` (idempotente).

1. Carrega `Lease`; rejeita com `LEASE_NOT_ACTIVE` se `Status != ACTIVE`.
2. Valida que `month` está em `[StartDate, EndDate]`; caso contrário `INVALID_MONTH`.
3. Dia de vencimento = dia do `StartDate`; se não existir no mês, último dia do mês.
4. Em transação, insere:
   - `Payment(type=RENT, competency=month, gross_amount=lease.RentAmount, due_date=...)`
   - Se `lease.IPTUReimbursable && AnnualIPTUAmount != nil`: `Payment(type=EXPENSE, competency=month, gross_amount=AnnualIPTUAmount/12, description="IPTU <year> - parcela MM/12")`. Sem `AnnualIPTUAmount` → `IPTU_MISSING`.
5. Índice único `(lease_id, competency, type)` torna inserção duplicada no-op; chamada re-gerativa retorna os existentes.
6. Retorna slice de Payments (novos + existentes).

Reajustes já atualizaram `RentAmount`; geração sempre usa valor vigente. Não há pré-geração em lote.

### 5.2 Multa e juros — cálculo on-read

Estado derivado enquanto payment não está pago:

```
se PaidDate == nil e now > DueDate:
  dias_atraso   = days(now - DueDate)
  late_fee      = gross * lease.LateFeePercent            // uma única vez
  interest      = gross * lease.DailyInterestPercent * dias_atraso
  status_efetivo = LATE
senão:
  late_fee = 0, interest = 0, status_efetivo = Status armazenado
```

`payment.Service.GetByID` e `ListByLease` enriquecem a resposta sem escrever no banco. A base dos juros é `gross_amount` puro — não há juros compostos sobre multa.

### 5.3 Pagamento e retenção IRRF

`PUT /api/v1/payments/{id}` com `paid_date` preenchido:

1. Se Status já = PAID → `ALREADY_PAID` (imutabilidade fiscal).
2. Recalcula `late_fee_amount` e `interest_amount` com base em `paid_date` (não em `now`).
3. Se `type=RENT` **e** `tenant.person_type == "PJ"`:
   - `base = gross + late_fee + interest`
   - `irrf_amount = fiscal.IRRFTable.Calculate(base, paid_date)`
   - Se tabela sem faixa válida para a data → `IRRF_TABLE_MISSING` 500.
4. Senão: `irrf_amount = 0`.
5. `net_amount = gross + late_fee + interest - irrf_amount`.
6. `status = PAID`; persiste todos os campos.

Fórmula IRRF:
```
faixa  = brackets onde valid_from <= paid_date e base em [min_base, max_base] (último valid_from)
imposto = max(0, base * faixa.rate - faixa.deduction)
```

### 5.4 Reajuste versionado

`POST /api/v1/leases/{id}/readjust`
```json
{ "percentage": 0.0523, "index_name": "IGPM", "applied_at": "2026-04-01", "notes": "..." }
```

1. Lease precisa estar `ACTIVE`; caso contrário `LEASE_NOT_ACTIVE`.
2. `percentage` em `(0, 1]` (zero e negativos rejeitados; máximo 100%); caso contrário `INVALID_PERCENTAGE`.
3. `new_amount = round(old_amount * (1 + percentage), 2)`.
4. Transação: insere `lease_readjustments` + `UPDATE leases SET rent_amount = new_amount`.
5. Reajuste não retroage — não mexe em payments já gerados.

### 5.5 Recibo mensal

`GET /api/v1/payments/{id}/receipt`

- Só se `Status = PAID`; caso contrário `PAYMENT_NOT_PAID` 409.
- Retorna JSON consolidado:

```json
{
  "payment_id": "...",
  "competency": "2026-04",
  "issued_at":  "2026-04-15",
  "owner":  { "name": "...", "document": "..." },
  "tenant": { "name": "...", "document": "...", "person_type": "PF" },
  "unit":   { "label": "...", "property_address": "..." },
  "amounts": {
    "gross": 2500.00, "late_fee": 250.00, "interest": 41.67,
    "irrf_withheld": 0, "net_paid": 2791.67
  },
  "paid_date": "2026-04-15",
  "legal_note": "Recibo emitido conforme Lei 8.245/91, art. 22, IV."
}
```

Renderização em PDF é responsabilidade do frontend.

### 5.6 Relatório fiscal anual

`GET /api/v1/fiscal/annual-report?year=YYYY`

Agrega payments PAID com `competency` no ano solicitado, agrupados por lease. Para cada lease:

- `total_received` = soma `gross + late_fee + interest` dos PAID.
- `total_irrf_withheld` = soma `irrf_amount`.
- `category` = `PJ_WITHHELD` se tenant é PJ, `CARNE_LEAO` se PF.
- `deductible_iptu_paid` = soma de `expense(category=TAX)` do owner pagos no ano (não dos payments de repasse).
- `monthly_breakdown` = lista por `competency`.

Totais no topo:
- `received_from_pj`: vai em "Rendimentos Tributáveis Recebidos de PJ" na DIRPF.
- `received_from_pf`: vai em "Carnê-leão".
- `total_irrf_credit`: crédito deduzível.
- `deductible_iptu`: despesa dedutível.

Ano sem dados retorna estrutura zerada (não 404).

## 6. API

### 6.1 Novos endpoints

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/leases/{id}/readjust` | Aplica reajuste versionado |
| GET | `/api/v1/leases/{id}/readjustments` | Histórico de reajustes |
| POST | `/api/v1/leases/{id}/payments/generate?month=YYYY-MM` | Gera RENT + IPTU do mês (idempotente) |
| GET | `/api/v1/payments/{id}/receipt` | Recibo mensal (status=PAID) |
| GET | `/api/v1/fiscal/annual-report?year=YYYY` | Relatório fiscal anual |

### 6.2 Endpoints modificados

| Rota | Mudança |
|---|---|
| `POST /api/v1/tenants` | `person_type` obrigatório |
| `PUT /api/v1/tenants/{id}` | aceita `person_type` |
| `POST /api/v1/leases` | aceita 5 campos novos (opcionais, defaults seguros) |
| `PUT /api/v1/leases/{id}` | aceita 5 campos novos |
| `GET /api/v1/payments/{id}` | inclui multa/juros calculados on-read |
| `GET /api/v1/leases/{id}/payments` | idem, cada item enriquecido |
| `PUT /api/v1/payments/{id}` | calcula retenção e persiste campos derivados |

### 6.3 Códigos de erro

| Código | HTTP | Quando |
|---|---|---|
| `INVALID_MONTH` | 400 | formato `YYYY-MM` inválido ou fora do range |
| `INVALID_PERCENTAGE` | 400 | percentual de reajuste fora de `(0, 1]` |
| `LEASE_NOT_ACTIVE` | 409 | geração/reajuste em lease ENDED/CANCELED |
| `PAYMENT_NOT_PAID` | 409 | recibo em payment não pago |
| `ALREADY_PAID` | 409 | PUT em payment já PAID |
| `IPTU_MISSING` | 409 | `iptu_reimbursable=true` sem `annual_iptu_amount` |
| `IRRF_TABLE_MISSING` | 500 | sem faixa vigente para `paid_date` |

### 6.4 Swagger

Todo handler novo com annotations completas (`@Summary/@Tags/@Security/@Accept/@Produce/@Param/@Success/@Failure/@Router`). `swag init` ao final.

## 7. Edge Cases

| Situação | Tratamento |
|---|---|
| `generate` com mês já gerado | 200 com payments existentes (idempotência) |
| `generate` parcial (RENT existe, IPTU não) | Insere só o que falta; retorna ambos |
| Pagamento antecipado | `late_fee=0, interest=0`; IRRF normal |
| Pagamento com `paid_date > now` | Permitido; data informada governa cálculo |
| Lease termina meio do mês | Gera mês completo; proporcional fora do escopo |
| Tenant PJ sem `document` | IRRF calculado normalmente; warning é problema do frontend |
| Base IRRF dentro da faixa isenta | `irrf = 0` naturalmente |
| Relatório em ano sem dados | Estrutura zerada, não 404 |
| Arredondamento monetário | `math.Round(x*100)/100` antes de persistir |

## 8. Invariantes Preservadas

- Soft-delete obrigatório: `lease_readjustments` e `irrf_brackets` são append-only (sem `is_active`).
- `owner_id` em toda query: `lease_readjustments.owner_id` replicado do lease. `irrf_brackets` é global (sem owner).
- UUIDs em toda entidade.
- SINGLE auto-cria Unit (não afetado).

## 9. Riscos Conhecidos (não mitigados nesta spec)

- **`float64` para moeda** — risco de arredondamento em juros diário × muitos dias. Mitigação leve via arredondamento a cada cálculo. Migração para tipo decimal é tech-debt do projeto inteiro.
- **Manutenção da tabela IRRF** — quando RFB publica nova tabela, admin insere linha com `valid_from` novo. Sem UI nesta spec; via migration ou SQL direto.
- **Timezone** — datas tratadas como `DATE`; vencimento às 23:59 local assumido. Jobs futuros que usem `now` dependem da TZ do servidor.

## 10. Testes

Segue `.claude/rules/backend-testing.md` — TDD obrigatório, mock struct local para service/handler, `testDB` real para repository.

### 10.1 Cobertura

**`tenant`**: `person_type` obrigatório; default correto em rows legados; troca PF↔PJ via PUT.

**`lease`**: reajuste aplica/persiste/atualiza; percentuais inválidos rejeitados; reajuste em lease ENDED rejeitado; reajuste não toca payments; histórico por lease.

**`payment`**:
- `GenerateMonth` idempotente; sem `iptu_reimbursable` não cria EXPENSE; lease ENDED rejeitado; mês fora do range rejeitado.
- `Enrich` calcula multa/juros corretamente; zero para pagamento antecipado.
- `MarkPaid` retém IRRF quando tenant PJ, não retém quando PF; persiste todos os campos derivados; rejeita payment já PAID.
- `BuildReceipt` bloqueia enquanto não PAID.
- Unique index garante idempotência sob concorrência.

**`fiscal`**:
- `IRRFTable.Calculate` para cada faixa; valores de borda; date-based lookup (tabela antiga vs nova).
- Relatório anual agrega só PAID do ano; separa PJ/PF corretamente; soma IRRF; agrupa IPTU do owner; ano sem dados retorna zeros.

### 10.2 Teste de integração ponta-a-ponta

1. Owner + property + unit + tenant (PJ) + lease com regras fiscais completas.
2. `/generate` para 3 meses consecutivos.
3. Marca 2 como PAID (um no prazo, um atrasado).
4. Chama relatório anual, valida totais, IRRF e breakdown.

### 10.3 Helpers

- `testDB` existente; `TRUNCATE ... CASCADE` precisa incluir `lease_readjustments`.
- `irrf_brackets` é seed estática — só truncar em testes que alteram faixas.
- Mock structs locais por módulo; `fiscal.Service` recebe mocks dos 4 repositories.

## 11. Rastreabilidade Legal

Comentários no código referenciam fonte legal onde a regra não é óbvia:

```go
// IRRF sobre aluguel PJ→PF: IN RFB 1.500/2014, art. 22; DARF 3208.
// Recibo de aluguel: Lei 8.245/91 art. 22, IV.
// Multa e juros: Lei 8.245/91 não fixa valores — são contratuais.
```

Exceção justificada à regra geral de "não comentar o quê": esses são "por quê legal", não "o quê técnico".

## Context

O dashboard atual em `frontend/src/data/dashboard/dal.ts` faz 3 requests separados (`properties`, `properties/{id}/units`, `tenants`) e depois calcula métricas no cliente. O problema é que `occupiedUnits`, `vacancyRate`, `recentPayments` e `expiringLeases` são todos hardcoded como `0` ou `[]` — a lógica de agregação nunca foi implementada. Similarly, `frontend/src/data/financial/dal.ts` define types para `Receivable`, `Payable`, `Transfer`, `Commission`, `BankRecord` mas todas as funções DAL retornam `[]` (stubs). As páginas `/financial/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao` existem mas mostram dados vazios.

## Goals / Non-Goals

**Goals:**
- Endpoint único `GET /api/v1/dashboard/metrics` com agregação de todas as métricas no Postgres
- Dashboard frontend usa o novo endpoint (remove N+1 requests)
- Endpoints financeiros `GET /api/v1/financial/transfers`, `/commissions`, `/bank-records`
- DAL financeira implementada com chamadas reais ao Go API
- Páginas financeiras populadas com dados reais

**Non-Goals:**
- Dashboard financeiro completo com gráficos (charts) — isso é UI, não API
- Notificações push ou real-time (WebSocket/SSE)
- Relatórios PDF export
- Integração com contabilidade externa

## Decisions

### 1. Dashboard: endpoint de agregação único vs. queries fragmentadas

**Decisão:** Criar `GET /api/v1/dashboard/metrics` que executa SQL aggregation no Postgres e retorna tudo em uma única resposta.

**Alternativa:** Manter múltiplos endpoints por domínio e fazer o frontend agregar. Descartado porque a lógica de `vacancyRate`, `occupiedUnits` e `expiringLeases` precisa de JOINs entre properties, units, leases e payments que o frontend não consegue fazer.

**Resultado:** Query SQL única com CTEs para properties, units, tenants, leases e payments. Evita N+1 e reduz latência.

### 2. Dashboard metrics via SQL aggregation vs. service layer

**Decisão:** Agregação no repository via raw SQL (CTEs) ao invés de múltiplas chamadas em memória.

**Justificativa:** Para métricas de dashboard, queries agregadas no banco são 10-100x mais eficientes que múltiplas round-trips. Permite usar `COUNT`, `SUM`, `AVG` nativos.

### 3. Financial: transfers calculados no backend

**Decisão:** `GET /api/v1/financial/transfers` calcula repasses no backend a partir de payments `PAID`. Usa `FinancialConfig` para obter taxa administrativa e deduzir do gross.

**Alternativa:** Frontend calcula. Descartado porque o cálculo de net value (gross - admin fee - discounts) requer configuração financeira que está no backend.

**Cálculo:** `net_value = gross_receipt - (gross_receipt * admin_fee_pct / 100) - discounts`

### 4. Financial: commissions baseadas em leases com corretores

**Decisão:** `GET /api/v1/financial/commissions` lista contratos que têm agente vinculado (futuro campo `broker_id` no lease). Por enquanto, commissions são stubs com dados vazios até o campo existir.

**MVP:** Commissions retorna array vazio com schema definido. Implementação real quando `broker_id` for adicionado.

### 5. Bank reconciliation via upload de extrato

**Decisão:** `GET /api/v1/financial/bank-records` + `POST /api/v1/financial/bank-records/import` para importar CSV de extrato. Matching automático com payments via data/amount.

**Alternativa:** Importação manual payment por payment. Descartado porque é workflow real de conciliação.

## API Design

### Dashboard

```
GET /api/v1/dashboard/metrics

Response:
{
  "total_properties": 12,
  "total_units": 48,
  "occupied_units": 42,
  "vacancy_rate": 12.5,
  "total_tenants": 38,
  "monthly_revenue": {
    "total": 85000.00,
    "paid": 78000.00,
    "pending": 5000.00,
    "overdue": 2000.00
  },
  "recent_payments": [
    { "id": "...", "description": "Aluguel Unit 101", "amount": 2500.00, "due_date": "2026-05-10", "status": "PAID", "tenant_name": "João Silva" }
  ],
  "expiring_leases": [
    { "id": "...", "unit_label": "Unit 203", "tenant_name": "Maria Santos", "end_date": "2026-06-30" }
  ]
}
```

### Financial

```
GET /api/v1/financial/transfers?status=PENDING&from=2026-01-01&to=2026-12-31
GET /api/v1/financial/commissions?property_id=...&from=...&to=...
GET /api/v1/financial/bank-records?from=...&to=...
POST /api/v1/financial/bank-records/import  (multipart CSV)
```

## Risks / Trade-offs

- **[Risk]** Dashboard com muitas properties/unidades pode demorar → **Mitigation:** Adicionar cache Redis com TTL de 5 min para métricas agregadas (futuro).
- **[Risk]** Bank reconciliation matching pode ser impreciso → **Mitigation:** Fuzzy match com tolerance de ±1 dia e ±5% no valor; flag para revisão manual.

## Migration Plan

1. Criar migration para `dashboard_metrics` view ou table (opcional, query direta é suficiente no MVP)
2. Criar `internal/dashboard/model.go`, `repository.go`, `service.go`, `handler.go`
3. Registrar dashboard handler em main.go
4. Atualizar `data/dashboard/dal.ts` para usar `GET /api/v1/dashboard/metrics`
5. Criar `internal/financial/` domain
6. Implementar transfers, commissions, bank-records handlers
7. Implementar `data/financial/dal.ts` com chamadas reais
8. Verificar se páginas financeiras já têm UI — se não, criar components básico

**Rollback:** Reverter DAL para código anterior (stubs). API de dashboard pode ficar como fallback retornando zeros.

## Open Questions

1. Qual período padrão para dashboard? Último mês? Current month?
2. Commissions precisam de campo `broker_id` em lease — está no roadmap? Se sim, incluir na migration desta change.
3. Bank reconciliation: formato de CSV esperado? Definir schema com bank_code, date, description, amount, type (credit/debit).
4. Transfer status workflow: PENDING → PROCESSED → TRANSFERRED. Qual ação muda cada status?
## Why

O dashboard atual retorna métricas zeradas — `occupiedUnits`, `vacancyRate`, `recentPayments` e `expiringLeases` são todos `0` ou `[]` porque não há endpoint de agregação no backend Go. Da mesma forma, as páginas financeiras (`/financial/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao`) têm DAL tipada mas todas as funções retornam arrays vazios. Essas são as funcionalidades mais visíveis do sistema e estão quebradas.

## What Changes

- Novo endpoint `GET /api/v1/dashboard/metrics` que agrega dados de properties, units, tenants, leases e payments em uma única resposta
- Fix no `getDashboardMetrics()` do frontend para usar o novo endpoint ao invés de múltiplos requests fragmentados
- Backend Go implementa `DashboardService` com lógica de contagem de unidades ocupadas, taxa de vacância, receita mensal, pagamentos recentes e contratos próximos do vencimento
- Endpoints financeiros: `GET /api/v1/financial/transfers`, `GET /api/v1/financial/commissions`, `GET /api/v1/financial/bank-records`
- Backend implementa lógica de repasses (cálculo de fees, descontos, net value) e comissões
- DAL do frontend (`data/financial/dal.ts`) passa de stubs para chamadas reais ao Go backend
- Pages financeiras passam de stub para UI funcional com dados reais

## Capabilities

### New Capabilities

- `dashboard-metrics-aggregation`: Endpoint único que calcula todas as métricas de dashboard (totalProperties, occupiedUnits, vacancyRate, monthlyRevenue, recentPayments, expiringLeases) via queries SQL agregadas no Postgres.
- `financial-transfers`: API para listar repasses de aluguel — calculado a partir de payments recibidos, deduzindo taxa administrativa e descontos, gerando net value a ser transferido.
- `financial-commissions`: API para listar comissões de corretores — calculado sobre valores de contratos, com retenção de ISS e IRRF.
- `financial-bank-reconciliation`: API para registrar e listar transações bancárias (importação de extrato) para conciliação com payments.

## Impact

- **Backend**: Novo `internal/dashboard/` com service + handler. Atualização em `internal/payment/service.go` para expor métodos de agregação. Novo `internal/financial/` com transfers, commissions, bank-records.
- **Frontend**: `data/dashboard/dal.ts` reescrito para usar `GET /api/v1/dashboard/metrics`. `data/financial/dal.ts` implementado com chamadas reais.
- **Database**: Possível necessidade de views SQL para agregações complexas (revenue por período, vacancy rate).
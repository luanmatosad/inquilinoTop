## Why

`/reports` ainda é um `ComingSoon`. O canvas (`Relatorios`, `Relatorios-por-imovel`, `M-Relatorios`) mostra quanto entrou, quanto saiu e quanto cada imóvel rendeu. Hoje nenhuma API entrega isso: `dashboard/metrics` só cobre o mês corrente e `fiscal/annual-report` é por contrato.

## What Changes

- Backend: módulo `report` com `GET /reports/overview?year=` (totais e série mensal de recebido e despesas) e `GET /reports/by-property?year=` (recebido, despesas e resultado por unidade). Base de **data de pagamento** e valor líquido; só meses completos.
- Frontend: hub `/reports` (indicadores do ano, gráfico mensal, cards Por imóvel e Inadimplência), `/reports/por-imovel` (tabela com total, cards no celular) e **Exportar planilha** (CSV).
- Inadimplência leva a Recebimentos com o chip Atrasadas (não há tela própria no canvas). O card Carnê-leão e DIRPF entra na change `relatorios-carne-leao`.
- Fora: tela de DIRPF anual, Por imóvel com período livre, categorias editáveis.

## Capabilities

### New Capabilities
- `reports-overview`: totais do ano, série mensal e hub de relatórios.
- `reports-by-property`: resultado por unidade e exportação em planilha.

### Modified Capabilities
Nenhuma.

## Impact

- Backend: novo `internal/report` (4 arquivos), `cmd/api/main.go`, Swagger, `CLAUDE.md`. Sem migration (só leitura de `payments`, `expenses`, `leases`).
- Frontend: `app/reports`, componentes de relatório, rota de CSV, `lib/report-overview.ts`; usa o `ui/chart` e o `recharts` já instalados.

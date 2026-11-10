## Why

O canvas (`Relatorios-carne-leao`, `M-Carne-leao`) traz o relatório que o locador pessoa física leva ao contador todo mês: rendimentos de aluguel, despesas que entram e a base estimada. Hoje esses números não existem em lugar nenhum, e o card correspondente ainda não aparece no hub de Relatórios.

## What Changes

- Backend: `GET /reports/carne-leao?month=AAAA-MM` no módulo `report`: rendimentos (aluguéis pagos no mês por inquilino **pessoa física**, por data de pagamento), despesas que entram (categorias Impostos e Condomínio pagas no mês) e base estimada; só meses encerrados.
- Frontend: `/reports/carne-leao?mes=` com a faixa de estado do mês (fechado ou aberto), os três totais, "Quem pagou" e "Despesas que entram", **Baixar para o contador** (PDF pela impressão), **Exportar planilha** (CSV) e o card Carnê-leão e DIRPF no hub.
- Fora: cálculo do imposto, DIRPF anual, categorias editáveis (seção Configurações), pagadores pessoa jurídica (IRRF retido na fonte).

## Capabilities

### New Capabilities
- `reports-carne-leao`: relatório mensal de carnê-leão (rendimentos, despesas que entram, base estimada, prazo) e sua exportação.

### Modified Capabilities
Nenhuma.

## Impact

- Backend: `internal/report` (novos métodos no repositório, service e handler), Swagger, `CLAUDE.md`. Sem migration.
- Frontend: `app/reports/carne-leao`, rota de CSV, componentes, `lib/carne-leao.ts`, card no hub. Consulta `GET /closings?month=` só para a faixa de estado.

## Why

O mês de recebimentos nunca "termina": o dono não tem um momento para conferir se tudo foi baixado, guardar os números e seguir. O canvas (`Fechamento-mes`, `Fechamento-confirmar`, `Fechamento-fechado`) traz o fechamento: conferir, fechar e consultar o retrato do mês depois, mesmo que as cobranças mudem.

## What Changes

- Backend: módulo `closing` com o fechamento mensal por organização. Fechar grava um **retrato** (snapshot) do mês: previsto, recebido, em atraso, cobranças pendentes, recibos e quem fechou. Reabrir exige um motivo; tudo fica num histórico.
- Só meses já encerrados (anteriores ao mês corrente em São Paulo) podem ser fechados. Pendências (atraso, aviso não confirmado) **não bloqueiam**: ficam registradas no retrato.
- Frontend: `/financial/receivables/fechamento?mes=AAAA-MM` com os três estados do canvas (conferir, confirmar, fechado), botão **Fechar {mês}** em Recebimentos e resumo em PDF pela impressão do navegador.
- Fora: bloquear edição das cobranças do mês fechado (o retrato é que não muda), arquivo de resumo em Relatórios, despesas, fechamento automático.

## Capabilities

### New Capabilities
- `month-closing`: fechar, reabrir e consultar o fechamento do mês (retrato, pendências, histórico).

### Modified Capabilities
- `receivables-overview`: ação **Fechar {mês}** e selo "Mês fechado" em Recebimentos para meses passados.

## Impact

- Backend: novo `internal/closing` (4 arquivos), migration 000051 (`month_closings`, `month_closing_events`), `cmd/api/main.go`, Swagger, `CLAUDE.md`. Lê cobranças pelo mesmo critério de Recebimentos.
- Frontend: rota de fechamento, componentes, botão em Recebimentos; sem dependência nova.

## Why

Contratos já geram e reajustam cobranças, mas as telas de dinheiro (`/financial/receivables` e `/financial/payables`) ainda estão no visual antigo ("Contas a Receber", "Contas a Pagar", filtros por período e uma tabela de contrato genérica). O canvas redesenhou as duas como Recebimentos e Despesas, por mês, com indicadores e uma ação clara por linha. Fechar essa ponta dá dados reais ao ciclo de cobrança, ao Hoje e ao Fechamento, que são as próximas ondas.

## What Changes

- Recebimentos (`/financial/receivables`): navegação por mês (`?mes=AAAA-MM`), indicadores Previsto, Recebido e Em atraso, chips Todas, Atrasadas, Pagas e Previstas (`?situacao=`), linhas com inquilino, unidade e imóvel, vencimento, valor e situação, ação **Registrar pagamento** (linha e topo) e **Recibo**. Cards no celular.
- Despesas (`/financial/payables`): mesmo formato, com Total do mês, Pagas e A pagar, chips Todas, A pagar e Pagas, categoria na linha, **Dar baixa** e **Desfazer pagamento**, e o painel **Lançar despesa** (`?novo=1`, aceita `&unidade=`).
- Backend: `POST /units/{unitId}/expenses` aceita `paid_date` opcional e cria a despesa já paga ("Já paguei"), numa só operação.
- Função pura `src/lib/financial-overview.ts` (linhas, indicadores, mês, situação) com a junção feita no servidor Next.
- **BREAKING (UI):** saem a baixa em lote, o aviso `LegacyExpensesNotice` e os filtros de período/contrato/unidade das duas telas; o canvas não os prevê.
- Fora desta etapa: Aguardando confirmação e Confirmar (nascem do "já paguei" do inquilino, fluxo 04), Cobrar e Enviar cobrança (mensagens, fluxo 04), Exportar, Repetir todo mês, comprovante da despesa, despesa de imóvel inteiro, categoria "Limpeza" e categorias editáveis.

## Capabilities

### New Capabilities
- `receivables-overview`: junção, situação, indicadores e mês da lista de Recebimentos.
- `payables-overview`: junção, situação, indicadores e mês da lista de Despesas.

### Modified Capabilities
- `accounts-receivable`: a tela de contas a receber passa a ser Recebimentos (mês, indicadores, chips, ações).
- `accounts-payable`: a tela de contas a pagar passa a ser Despesas (mês, indicadores, chips), sai a baixa em lote, e lançar despesa aceita "já paguei".

## Impact

- Backend `expense`: `model.go` (`PaidDate` em `CreateExpenseInput`), `repository.go` (insert já pago), `service.go`, `handler.go` (Swagger), testes.
- Frontend: `app/financial/{receivables,payables}/page.tsx`, `app/financial/actions.ts` (`createExpense` já existe em `app/expenses/actions.ts`), novos componentes em `components/financial/`, `lib/financial-overview.ts`, `lib/financial-schemas.ts`, testes; remoção de `PayablesTable`, `ReceivablesTable`, `LegacyExpensesNotice`, `FilterBar` se ficarem sem uso.
- Sem migration: a tabela `expenses` já guarda `status`, `paid_date` e `paid_amount`.

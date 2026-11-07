## Context

Telas do canvas: `Recebimentos`, `Despesas`, `Despesas-lancar` e as de celular `M-Recebimentos`, `M-Despesas`, `M-Despesa-lancar`. Estado atual, verificado no repo:

- **`payment`:** `GET /payments?status=&from=&to=&lease_id=` devolve `PENDING`, `LATE` (calculado) e `PAID`, com multa e juros; `GET /payments/summary`; baixa manual por `PUT /payments/{id}` com `status=PAID` e `paid_date`; recibo em `/financial/receivables/[id]/receipt`. Não existe status "aguardando confirmação".
- **`expense`:** `GET /expenses` (da organização, com `from`, `to`, `status`, `unit_id`), `GET /expenses/summary`, `POST /units/{unitId}/expenses`, `POST /expenses/{id}/pay` e `/unpay`. Categorias fixas no CHECK do banco: `ELECTRICITY`, `WATER`, `CONDO`, `TAX`, `MAINTENANCE`, `OTHER`. A despesa exige `unit_id`.
- **Frontend atual:** `financial/receivables` e `financial/payables` com `FilterBar` (período, status, contrato/unidade), `SummaryCards`, tabelas, diálogo de baixa e baixa em lote; `actions.ts` já tem `listReceivables`, `payReceivable`, `payExpense`, `unpayExpense`, `payExpensesBatch`. `ExpenseDialog` continua em uso em `/units/[id]`.
- **Padrão das ondas anteriores:** painel `Sheet` por URL, junção no servidor Next por função pura, `Promise.allSettled` com degradação, tabela no desktop e cards no celular, `America/Sao_Paulo` para "hoje".

## Goals / Non-Goals

**Goals:** Recebimentos e Despesas fiéis ao canvas (exceto o que depende do fluxo 04), por mês, no desktop e no celular; registrar pagamento e dar baixa funcionando; lançar despesa, inclusive já paga.

**Non-Goals:** Aguardando confirmação, Confirmar, Cobrar, Enviar cobrança, Exportar, recorrência, comprovante, despesa de imóvel inteiro, categorias editáveis, paginação.

## Decisions

**1. Rotas e nomes.** Ficam `/financial/receivables` e `/financial/payables` (nav, redirects `/payments` e `/expenses` e o link "Ver todas" do contrato dependem delas). Só os títulos mudam para Recebimentos e Despesas.

**2. Mês por URL.** `?mes=AAAA-MM`, padrão o mês corrente em São Paulo, com botões mês anterior e próximo. Valor inválido cai no mês corrente. O intervalo vira `from`/`to` (primeiro e último dia do mês) para o backend.

**3. Quais linhas entram.** Recebimentos: cobranças `RENT` com vencimento no mês **mais** as `LATE` de qualquer mês, como a lista de Inquilinos. Despesas: despesas com vencimento no mês mais as `LATE` de qualquer mês. Duas buscas por tela (mês e `status=LATE`), unidas sem duplicar por `id`. Os indicadores somam as linhas exibidas, de modo que Previsto de R$ 8.300 inclui a atrasada de outubro, como no canvas. Só `RENT` aparece em Recebimentos; IPTU e caução continuam no extrato do contrato.

**4. Indicadores.** Recebimentos: **Previsto** = soma do bruto de todas as linhas ("N cobranças"); **Recebido** = soma do bruto das `PAID` ("X de N pagas"); **Em atraso** = soma do bruto das `LATE` ("N cobrança(s)"). O valor atualizado com multa e juros aparece só no diálogo de pagamento. Despesas: **Total do mês**, **Pagas** e **A pagar** (`PENDING` + `LATE`). Cálculo no servidor Next, não no `/summary`, porque o recorte "mês mais atrasadas" não é o do backend.

**5. Situação.** Recebimentos: Atrasado, Pago, Previsto. Despesas: Atrasada, Paga, A pagar. Chips por URL: `?situacao=LATE|PAID|PENDING`, sem o chip "Aguardando confirmação". Em Despesas o chip "A pagar" agrupa `PENDING` e `LATE`, e a linha atrasada mostra o selo "Atrasada".

**6. Registrar pagamento.** Um diálogo (estado local) com a cobrança escolhida e a data, reaproveitando `payReceivable`. Vindo da linha, a cobrança vem escolhida; vindo do topo, o diálogo lista as abertas. Mostra o valor atualizado ("com multa e juros") para `LATE`. Recibo é um link na linha `PAID`.

**7. Dar baixa e desfazer em Despesas.** Reaproveita `payExpense` (data e valor opcional) e `unpayExpense`, em diálogos locais. A baixa em lote e o aviso de despesas antigas saem, pois o canvas não os prevê.

**8. Lançar despesa (`?novo=1`).** Painel com descrição, unidade (lista "Unidade · Imóvel"; `&unidade=` pré-seleciona), categoria (rótulos em português do enum), valor, vencimento e "Já paguei" com data. O backend ganha `paid_date` opcional em `CreateExpenseInput`: o repositório insere já com `status=PAID`, `paid_date` e `paid_amount = amount`, numa só instrução, para uma falha não deixar a despesa "a pagar" depois de o usuário ter dito que pagou. Sem `paid_date`, o comportamento atual não muda. Data de pagamento antes de hoje é aceita; depois de hoje é recusada (400).

**9. Junção no servidor.** `buildReceivableRows(payments, leases, tenants, properties)` e `buildPayableRows(expenses, properties)` em `lib/financial-overview.ts`, com `"—"` quando o contrato, o inquilino ou a unidade não aparecem. Buscas em paralelo com `Promise.allSettled`; pagamentos ou despesas são obrigatórios, o resto degrada com aviso.

**10. Fora do canvas, mantido por ora.** `Exportar` e `Repetir todo mês` não aparecem. Os blocos de código antigos sem uso (`FilterBar`, tabelas, `payExpensesBatch`, `LegacyExpensesNotice`) são removidos no fim, depois de conferir as referências.

## Risks / Trade-offs

- [Listas não paginam; a junção cresce com a base] → mesmo risco das ondas anteriores; registrado no `frontend/CLAUDE.md`.
- ["Em atraso" em bruto subestima o que o inquilino deve] → o valor atualizado fica no diálogo e no recibo; reavaliar no ciclo de cobrança.
- [Remover baixa em lote tira uma função de quem já a usava] → o canvas não a prevê; fica registrado como removida na spec, com a baixa individual no lugar.
- [Despesa de imóvel inteiro fica sem lugar] → o MVP lança por unidade; imóveis `SINGLE` já têm a unidade automática.

## Open Questions

- Rótulo da categoria `OTHER`: "Outros" (assumido). "Limpeza" do canvas depende das categorias editáveis (seção 15).

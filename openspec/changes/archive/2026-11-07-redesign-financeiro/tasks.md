## 1. Backend: despesa já paga

- [x] 1.1 Testes de serviço e handler: `paid_date` cria `PAID` com `paid_amount` igual ao valor, sem `paid_date` segue pendente, data futura retorna 400
- [x] 1.2 Teste de repositório (integração): inserção já paga grava `status`, `paid_date` e `paid_amount` numa instrução
- [x] 1.3 Implementar `PaidDate *time.Time` em `CreateExpenseInput`, a validação de data futura, o insert já pago e a anotação Swagger; regenerar `docs/`
- [x] 1.4 Atualizar `backend/internal/expense/CLAUDE.md` e a spec `accounts-payable` no código das rotas

## 2. Frontend: módulos puros (specs receivables-overview e payables-overview)

- [x] 2.1 Testes de `parseMonth`/`monthRange`/`shiftMonth`/`formatMonthLabel` (padrão em São Paulo, inválido cai no corrente, virada de ano, "Novembro de 2026")
- [x] 2.2 Testes de `buildReceivableRows`: linha completa, atraso de outro mês sem duplicar, só `RENT`, contrato/inquilino/unidade ausentes
- [x] 2.3 Testes de `receivableIndicators` (Previsto, Recebido "X de N pagas", Em atraso, zero) e de `payableRows`/`payableIndicators` (categorias em português, Total, Pagas, A pagar com atrasadas)
- [x] 2.4 Testes de `filterBySituation` (chips, contagens, A pagar inclui atrasadas)
- [x] 2.5 Implementar `src/lib/financial-overview.ts` e atualizar `financial-schemas.ts` (schema de lançar despesa com "já paguei", payload com `paid_date`)

## 3. Frontend: Recebimentos

- [x] 3.1 Testes da página: título, mês e navegação, indicadores, linha do canvas, "—" em dados ausentes, chips e `?situacao=`, estado vazio, erro com nova tentativa, aviso de dados parciais, cards no celular
- [x] 3.2 Reescrever `financial/receivables/page.tsx` (buscas em paralelo do mês e `status=LATE`, `Promise.allSettled`) e criar `ReceivablesView`/indicadores/chips/tabela/cards em `components/financial/`
- [x] 3.3 Testes do diálogo Registrar pagamento: pela linha, pelo topo com lista, valor atualizado em atrasada, sucesso, erro
- [x] 3.4 Implementar `RegisterPaymentDialog` reaproveitando `payReceivable`; link Recibo na linha paga

## 4. Frontend: Despesas

- [x] 4.1 Testes da página: título, mês, indicadores, linha do canvas, categorias, chips, vazio, erro, unidade ausente, cards
- [x] 4.2 Reescrever `financial/payables/page.tsx` e criar tabela/cards de despesas
- [x] 4.3 Testes do painel Lançar despesa: campos, `?unidade=`, validação, "Já paguei" leva `paid_date`, fechar tira só o parâmetro
- [x] 4.4 Implementar `ExpenseFormSheet` (`?novo=1`) e a action `createExpense` com `paid_date`
- [x] 4.5 Testes e implementação de dar baixa e desfazer pagamento (diálogos locais reaproveitando `payExpense` e `unpayExpense`)

## 5. Limpeza e integração

- [x] 5.1 Remover `PayablesTable`, `ReceivablesTable`, `LegacyExpensesNotice`, `FilterBar` e `payExpensesBatch` se ficarem sem uso, conferindo as referências; manter `ExpenseDialog` e `ExpenseList` (usados em `/units/[id]`)
- [x] 5.2 Ajustar testes antigos que dependiam das telas removidas
- [x] 5.3 Rodar `make frontend-lint` e a suíte Vitest completa; tudo verde
- [x] 5.4 Rodar a suíte Go (`-p 1`); só o `TestService_GenerateMonth_IPTUMissing` já falhava antes

## 6. Verificação

- [x] 6.1 Reconstruir backend e frontend e conferir pela API com o usuário de `make seed-dev-user`: criar despesa já paga e pendente, dar baixa, desfazer, registrar pagamento de cobrança atrasada; limpar os dados no fim
- [x] 6.2 Percorrer no navegador, desktop e 390px: Recebimentos, Despesas, lançar, baixa e recibo; registrar o que não foi visto
- [x] 6.3 Atualizar `frontend/CLAUDE.md` com os padrões de Financeiro e a tabela de páginas

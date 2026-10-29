## 1. Banco de dados

- [x] 1.1 Escrever `000040_add_expense_payment_fields` up/down (`status` com CHECK, `paid_date`, `paid_amount`, índice `(organization_id, status, due_date)`)
- [x] 1.2 Aplicar e reverter no Postgres de testes (`:5433`) e confirmar que despesas existentes ficam `PENDING`

## 2. Backend: expense (TDD)

- [x] 2.1 Atualizar `model.go`: campos novos, `PayExpenseInput`, filtros (`status`, `from`, `to`, `unit_id`) e interface `Repository`
- [x] 2.2 Escrever testes de service: baixa (valor padrão e diferente), baixa repetida, estorno, estorno de pendente, `LATE` derivado, bloqueio de `amount`/`due_date` em paga
- [x] 2.3 Implementar service e repository (filtros em SQL com `organization_id`, `LATE` por condição de data; `Create` agora grava `owner_id` com o usuário, e não com o id da organização, que violava a FK para `users` fora do caso legado em que org e usuário compartilham id)
- [x] 2.4 Testes de integração do repositório (filtros, limites do período inclusivos, isolamento por organização)
- [x] 2.5 Implementar resumo `GET /api/v1/expenses/summary` (a vencer, vencidos, pagos) com testes
- [x] 2.6 Handler: `POST /expenses/{id}/pay`, `POST /expenses/{id}/unpay`, filtros na listagem, códigos `EXPENSE_ALREADY_PAID` e `EXPENSE_LOCKED`, Swagger
- [x] 2.7 Registrar baixa e estorno no `audit`
- [x] 2.8 Atualizar `internal/expense/CLAUDE.md` e checar uso de despesas em `internal/dashboard` e `internal/fiscal` (dashboard não lê despesas; fiscal soma despesas `TAX` por vencimento, independente do status)

## 3. Backend: payment

- [x] 3.1 Testes de filtros em `GET /payments` (`status`, `from`, `to`, `lease_id`) incluindo `LATE`
- [x] 3.2 Implementar filtros no repositório e service, preservando o cálculo de multa e juros (a listagem da organização não calculava LATE, multa e juros; agora passa por `Enrich`, com cache de contratos por chamada)
- [x] 3.3 Implementar `GET /api/v1/payments/summary` (rota registrada antes de `/payments/{id}`) com testes
- [x] 3.4 Conferir baixa de cobrança paga (409) e recibo de cobrança não paga (409); corrigir se divergir
- [x] 3.5 Atualizar Swagger (`swag init`) e `internal/payment/CLAUDE.md`
- [ ] 3.6 `make test-backend` e `make test-backend-integration` sem falhas (`expense`, `payment` (exceto 1 teste), `lease`, `dashboard`, `tenant`, `property` passam; restam falhas preexistentes em `audit`, `support` e `TestFinancialRepository_DeleteFinancialConfig_SoftDelete`)

## 4. Frontend: dados

- [ ] 4.1 Atualizar `GoExpense`/`GoPayment` e `src/data/financial/dal.ts` com status real, valores pagos e resumos
- [ ] 4.2 Actions para baixa, estorno, baixa em lote, filtros e resumos em `src/app/financial/actions.ts`, tratando 404/409/422
- [ ] 4.3 Remover mapeamentos que inventavam status de despesa

## 5. Frontend: telas

- [ ] 5.1 `/financial/receivables`: filtros (período, status, imóvel), cartões de totais, badge de atraso, valor atualizado, ação "Dar baixa" e link do recibo
- [ ] 5.2 `/financial/payables`: filtros, cartões de totais, badge de atraso, "Dar baixa" e "Estornar"
- [ ] 5.3 Baixa em lote em contas a pagar (seleção múltipla, data única, relatório de falhas)
- [ ] 5.4 Estados de carregamento, vazio e erro nas duas telas
- [ ] 5.5 Redirecionar `/payments` e `/expenses` para as telas financeiras (mantendo criação de despesa acessível)
- [ ] 5.6 Ajustar `Sidebar`: manter Contas a Receber e a Pagar e ocultar Conciliação, Repasses e Comissões (rotas preservadas)
- [ ] 5.7 Aviso na primeira abertura sobre despesas antigas `PENDING` e como baixá-las em lote

## 6. Verificação

- [ ] 6.1 `make frontend-lint` e build sem erros
- [ ] 6.2 Fluxo manual: contrato com cobranças, baixar uma em atraso, lançar despesa, baixar e estornar, conferir totais
- [ ] 6.3 `openspec validate mvp-contas-pagar-receber`

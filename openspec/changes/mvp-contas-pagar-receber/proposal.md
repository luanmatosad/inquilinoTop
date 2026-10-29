## Why

Controlar contas a pagar e a receber é o objetivo central do MVP. Contas a receber já existe sobre `payment` (status, multa, juros, recibo, cobrança PIX/boleto). Contas a pagar é só uma lista de `expense` sem status nem data de pagamento: não dá para saber o que foi pago, o que está vencido nem quanto falta. As telas `/financial/receivables` e `/financial/payables` existem, mas o status de despesas não tem origem real no backend.

## What Changes

- `expense` ganha `status` (`PENDING` ou `PAID`), `paid_date` e `paid_amount`. `LATE` é derivado na leitura (vencida e não paga), igual ao `payment`.
- Nova ação de baixa: `POST /api/v1/expenses/{id}/pay` com data e valor pago; e estorno de baixa enquanto não conciliada.
- Listagens `GET /api/v1/expenses` e `GET /api/v1/payments` passam a aceitar filtros `status`, `from`, `to` (vencimento) e `unit_id`/`lease_id`.
- Endpoint de resumo para ambos os lados: totais a vencer, vencidos e pagos no período.
- Frontend: `/financial/receivables` e `/financial/payables` com filtros reais, baixa manual, totais e indicador de atraso, só shadcn/ui. Ligar `/payments` e `/expenses` a essas telas (uma entrada por lado no `Sidebar`).
- Remover o que não tem backend e não é do MVP das telas financeiras (comissões, repasses, conciliação) do menu, mantendo as rotas ocultas.
- **BREAKING**: resposta de `expense` ganha campos; despesas existentes assumem `PENDING` na migration.

## Capabilities

### New Capabilities
- `accounts-receivable`: controle de valores a receber de aluguel e encargos: filtros, baixa manual, atraso e totais.
- `accounts-payable`: controle de despesas a pagar por unidade: status, baixa, atraso e totais.

### Modified Capabilities
<!-- Nenhum spec existente. -->

## Impact

- **Backend**: `internal/expense` (model, repository, service, handler, testes), `internal/payment` (filtros e resumo), migration `000040_add_expense_payment_fields`, Swagger, `internal/dashboard` (despesas pagas e a pagar, se usado).
- **Frontend**: `src/app/financial/{receivables,payables}`, `src/app/financial/actions.ts`, `src/data/financial/dal.ts`, `src/app/{payments,expenses}`, `Sidebar`.
- **Dados**: backfill seguro (`status='PENDING'`, sem `paid_date`).
- **Depende de**: `mvp-contratos` (cobranças vêm de contratos válidos).
- **Fora de escopo**: despesas recorrentes e parceladas, rateio, anexos, conciliação bancária, repasse ao proprietário, comissões, conta a pagar sem unidade (fornecedor genérico).

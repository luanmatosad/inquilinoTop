## Context

- `payment.Payment`: status PENDING|PAID|LATE (LATE calculado na leitura quando vencido, com multa e juros), `paid_date`, valores brutos/líquidos, cobrança PIX/BOLETO/TED, recibo. `GET /payments?status=` já filtra por status; imutável, sem Delete (ADR payment-0001).
- `expense.Expense`: unit_id, description, amount, due_date, category, is_active. Sem status. `GET /expenses` lista por organização.
- Frontend: `/financial/actions.ts` mapeia `GoPayment` e `GoExpense` para `Receivable`/`Payable`; como `GoExpense` não traz status, o status de payables não tem fonte real.
- Sidebar tem Contas a Receber/Pagar, Conciliação, Repasses e Comissões; só os dois primeiros têm backend.

## Goals / Non-Goals

**Goals:**
- Saber, por período, o que há a receber e a pagar, o que venceu e o que foi baixado.
- Baixa manual rápida dos dois lados.

**Non-Goals:**
- Recorrência/parcelamento, conciliação bancária, repasse, comissões, anexos.

## Decisions

### D1. Status de despesa persistido e atraso derivado
Coluna `status` com `PENDING|PAID`; `LATE` não é gravado: o service devolve `LATE` quando `PENDING` e `due_date < hoje`. Mesmo critério do `payment`, evitando job de atualização. Alternativa: persistir `LATE` por scheduler. Rejeitada: estado que pode ficar defasado. Filtro `status=LATE` vira condição de data na consulta.

### D2. Baixa de despesa
`POST /expenses/{id}/pay` `{paid_date, paid_amount?}` (valor padrão = `amount`). Só `PENDING` pode ser baixada. Estorno `POST /expenses/{id}/unpay` volta a `PENDING` e zera data e valor, permitido sem prazo no MVP (sem conciliação para travar). Registra `audit`. Alternativa: usar `PUT`. Rejeitada: o `PUT` atual reutiliza `CreateExpenseInput` e misturaria edição de dados com mudança de estado.

### D3. Despesa paga não muda de valor
`PUT /expenses/{id}` em despesa `PAID` rejeita mudança de `amount` e `due_date` (409); descrição e categoria podem mudar. Evita divergência entre previsto e pago.

### D4. Filtros e resumo
Filtros `status`, `from`, `to`, `unit_id`/`lease_id` na consulta SQL (não no frontend), sempre com `organization_id`. Resumo em `GET /api/v1/payments/summary` e `GET /api/v1/expenses/summary` retornando `{to_receive|to_pay, overdue, paid}` em valor e quantidade para o período. Rota `/payments/summary` declarada antes de `/payments/{id}` para não colidir. Alternativa: somar no cliente. Rejeitada: paginação futura quebraria os totais.

### D5. Valor em atraso de recebíveis
Recebível vencido exibe valor bruto, multa e juros calculados (já feito pelo `payment`) e total atualizado. O resumo usa o total atualizado em "vencidos".

### D6. Frontend
Duas telas (`/financial/receivables`, `/financial/payables`) com `table`, filtros por período/status/imóvel, `badge` de status, cartões de totais e ação "Dar baixa" em `dialog` com data e valor. `/payments` e `/expenses` passam a redirecionar para elas (ou viram atalho de criação). Itens sem backend (conciliação, repasses, comissões) saem do `Sidebar`; rotas permanecem e nada é apagado.

### D7. Migração de dados
`000040_add_expense_payment_fields`: `status TEXT NOT NULL DEFAULT 'PENDING' CHECK`, `paid_date DATE`, `paid_amount FLOAT8`, índice `(organization_id, status, due_date)`. Despesas existentes ficam `PENDING`, e o usuário baixa as já pagas.

## Risks / Trade-offs

- [Despesas antigas já pagas aparecem como vencidas] → Aviso na primeira abertura e baixa em lote simples (seleção múltipla com mesma data).
- [Valor float8] → Mantém o padrão atual; arredondar em 2 casas na baixa. Migrar para decimal fica fora do MVP.
- [Estorno livre] → Auditado; reavaliar quando houver conciliação.
- [Esconder telas do menu parece perda] → Comunicar na release; rotas continuam acessíveis por URL.
- [`LATE` derivado dificulta consultas agregadas] → Condição de data única, coberta por teste de integração.

## Migration Plan

1. Migration `000040` aditiva.
2. Backend e testes; deploy compatível (campos novos opcionais para clientes antigos).
3. Frontend nas duas telas.
4. Rollback: down remove colunas; nenhuma perda de dados anteriores.

## Open Questions

- Despesa sem unidade (ex.: contador, taxa do proprietário)? Proposta: fora do MVP; exige `unit_id` opcional e mexe no modelo.
- Baixa em lote entra no MVP ou depois? Proposta: entra, simples, para mitigar o backfill.

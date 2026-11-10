# report — Relatórios financeiros

Agregações de leitura para a tela Relatórios (hub e Por imóvel). Sem tabelas próprias: lê `payments`, `leases` e `expenses` por `organization_id`. Permissão de leitura de pagamentos.

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/reports/overview?year=AAAA | `{year, through_month, months:[{month, received, expenses}], totals:{received, expenses, result, payments_count}}` |
| GET | /api/v1/reports/by-property?year=AAAA | `{year, through_month, rows:[{unit_id, received, expenses, result}], totals}` |
| GET | /api/v1/reports/carne-leao?month=AAAA-MM | `{month, due_date, income:{total, count, lines:[{payer, unit_id, paid_date, amount}]}, deductions:{total, count, lines:[{description, unit_id, category, amount}]}, base}` |

`year` ausente, inválido, anterior a 2000 ou futuro = 400 `INVALID_YEAR`. `month` inválido = 400 `INVALID_MONTH`; mês corrente ou futuro = 422 `MONTH_NOT_ENDED`.

## Regras

- **Base de caixa:** recebido = `RENT` `PAID` por `paid_date`, valor `net_amount` (senão `gross_amount`); despesas = `PAID` por `paid_date`, valor `paid_amount`; resultado = recebido − despesas. Pode diferir do Fechamento (`closing`), que é por vencimento e bruto.
- **Meses completos:** ano corrente vai de janeiro ao mês anterior ao corrente em `APP_TIMEZONE` (em janeiro: `through_month` 0, listas vazias e nenhuma consulta); anos passados têm 12 meses.
- `months` traz todos os meses até `through_month`, mesmo zerados. `rows` traz só unidades com movimento, por resultado decrescente. O rótulo da unidade fica no frontend (junta `/properties`).
- Soma e agrupamento no SQL; arredondamento a 2 casas no service. Se a base crescer muito, materializar.

## Carnê-leão

- **Rendimentos:** aluguéis `RENT` `PAID` com `paid_date` no mês, só de inquilino `person_type='PF'` (PJ tem IRRF retido na fonte), valor `net_amount` (senão bruto), por data de pagamento.
- **Despesas que entram:** `PAID` por `paid_date`, categorias de `DeductibleCategories` (`TAX` e `CONDO`, fixas até existir a tela Configurações). O rótulo das categorias e das unidades fica no frontend.
- **Base** = rendimentos − despesas, nunca abaixo de zero (os totais brutos continuam nas seções). **Prazo** (`due_date`) = último dia útil (segunda a sexta, sem feriados) do mês seguinte.
- Só meses encerrados, como o Fechamento. Os números **não** usam o retrato do `closing` (por vencimento, bruto).

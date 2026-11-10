# report — Relatórios financeiros

Agregações de leitura para a tela Relatórios (hub e Por imóvel). Sem tabelas próprias: lê `payments`, `leases` e `expenses` por `organization_id`. Permissão de leitura de pagamentos.

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/reports/overview?year=AAAA | `{year, through_month, months:[{month, received, expenses}], totals:{received, expenses, result, payments_count}}` |
| GET | /api/v1/reports/by-property?year=AAAA | `{year, through_month, rows:[{unit_id, received, expenses, result}], totals}` |

`year` ausente, inválido, anterior a 2000 ou futuro = 400 `INVALID_YEAR`.

## Regras

- **Base de caixa:** recebido = `RENT` `PAID` por `paid_date`, valor `net_amount` (senão `gross_amount`); despesas = `PAID` por `paid_date`, valor `paid_amount`; resultado = recebido − despesas. Pode diferir do Fechamento (`closing`), que é por vencimento e bruto.
- **Meses completos:** ano corrente vai de janeiro ao mês anterior ao corrente em `APP_TIMEZONE` (em janeiro: `through_month` 0, listas vazias e nenhuma consulta); anos passados têm 12 meses.
- `months` traz todos os meses até `through_month`, mesmo zerados. `rows` traz só unidades com movimento, por resultado decrescente. O rótulo da unidade fica no frontend (junta `/properties`).
- Soma e agrupamento no SQL; arredondamento a 2 casas no service. Se a base crescer muito, materializar.

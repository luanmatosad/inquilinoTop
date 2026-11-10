## Context

Canvas: hub com Recebido no ano ("10 meses"), Despesas, Resultado e gráfico mensal; Por imóvel com linhas "Ap 302 · Ed. Aurora" (unidade e imóvel), Recebido, Despesas, Resultado e total. Verificado: `payments.paid_date` e `net_amount` (DATE e líquido), `expenses.status/paid_date/paid_amount` (PAID sempre com data e valor), `payments → leases → unit_id`, `expenses.unit_id`; `ui/chart.tsx` e `recharts` já existem; o item de menu Relatórios já existe.

## Goals / Non-Goals

**Goals:** números de dinheiro calculados uma vez, no SQL, por ano; hub e Por imóvel como no canvas; CSV.
**Non-Goals:** carnê-leão e DIRPF, período livre, categorias editáveis, tela de Inadimplência.

## Decisions

1. **Módulo novo `report`, SQL próprio** (como `dashboard`): leitura direta de `payments`, `leases` e `expenses` com escopo por `organization_id`. O `fiscal` não muda.
2. **Base de caixa.** Recebido = aluguéis `RENT` `PAID` por `paid_date`, valor `net_amount` (senão bruto). Despesas = `PAID` por `paid_date`, valor `paid_amount`. Resultado = recebido menos despesas. Pode diferir do Fechamento (por vencimento, bruto); a tela diz "por data de pagamento".
3. **Meses completos.** Ano corrente: de janeiro ao mês anterior ao corrente em São Paulo (hoje, outubro); anos passados: 12 meses; ano futuro: 400 `INVALID_YEAR`. Em janeiro, sem mês completo, devolve série vazia e totais zerados. O rótulo "Janeiro a outubro de 2026" vem do `through_month`.
4. **Rotas** (auth, permissão de leitura de pagamentos). `overview`: `{year, through_month, months:[{month:"AAAA-MM", received, expenses}], totals:{received, expenses, result, payments_count}}`, com todos os meses de janeiro a `through_month`, mesmo zerados. `by-property`: `{year, through_month, rows:[{unit_id, received, expenses, result}], totals}`, só unidades com movimento, ordenadas por resultado decrescente.
5. **Rótulos no frontend.** O backend devolve `unit_id`; a página junta `/properties` para "Unidade · Imóvel" (como as outras telas) e mostra "—" se falhar.
6. **Hub.** Seletor de ano (`?ano=`, padrão o corrente; anos de 2020 até o corrente), três indicadores, gráfico de barras Recebido x Despesas (`ui/chart`) e três cards: Por imóvel (`/reports/por-imovel`), Inadimplência (`/financial/receivables?situacao=LATE`) e, depois, Carnê-leão. Celular: resumo, sem gráfico, como `M-Relatorios`.
7. **Por imóvel.** Tabela com total; no celular, cards (o canvas não traz prancha). **Exportar planilha** = rota `GET /api/reports/por-imovel?ano=` no Next que busca o backend e devolve CSV (UTF-8 com BOM, separador `;`, vírgula decimal, nome `resultado-por-imovel-AAAA.csv`).
8. **Falhas.** Backend fora do ar: mensagem "Não foi possível carregar os relatórios" com tentar de novo; imóveis fora: rótulos "—".

## Risks / Trade-offs

- Totais de caixa podem não bater com o Fechamento (por vencimento); a tela explica a base.
- Uma consulta SQL por relatório sobre o ano inteiro: adequado ao porte atual; se crescer, materializar.
- Despesa paga em um mês e cobrança paga em outro cruzam por data de pagamento, não de competência (aceito, é a base de caixa).

## Migration Plan

Sem migration. Rollback: reverter os commits; `/reports` volta ao `ComingSoon`.

## Open Questions

Nenhuma bloqueante.

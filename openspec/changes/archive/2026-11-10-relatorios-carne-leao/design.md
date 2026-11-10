## Context

Canvas: faixa "Outubro está fechado" com o prazo (30/11/2026) e o aviso de que o cálculo do imposto é do programa da Receita ou do contador; três totais (Rendimentos de aluguel com "N pagamentos recebidos", Despesas que entram com "N despesas, categorias marcadas", Base de cálculo estimada); "Quem pagou" (Pagador, Imóvel, Recebido em, Valor); "Despesas que entram" (Despesa, Imóvel, Categoria, Valor); ações Baixar para o contador e Exportar planilha. Verificado: `tenants.person_type` (PF ou PJ), `payments.paid_date`/`net_amount`, `expenses.paid_date`/`paid_amount`/`category` (enum com `TAX` e `CONDO`), `GET /closings?month=` já existe (change `fechamento-mes`), `report` já tem o padrão de base de caixa.

## Goals / Non-Goals

**Goals:** relatório mensal pronto para o contador, com a mesma base de caixa do hub; faixa de estado ligada ao Fechamento.
**Non-Goals:** calcular o imposto, DIRPF anual, editar categorias, pagadores PJ.

## Decisions

1. **Dentro do módulo `report`.** Novo `GET /reports/carne-leao?month=AAAA-MM`, mesma permissão de leitura de pagamentos e escopo por organização.
2. **Rendimentos.** Aluguéis `RENT` `PAID` com `paid_date` no mês, de inquilino com `person_type='PF'`, valor `net_amount` (senão bruto). Linhas: pagador, `unit_id`, data de pagamento e valor, ordenadas por data. PJ fica fora (tem IRRF retido na fonte).
3. **Despesas que entram.** Despesas `PAID` com `paid_date` no mês, categorias **fixas** `TAX` (rótulo "Impostos") e `CONDO` ("Condomínio"), valor `paid_amount`. Linhas: descrição, `unit_id`, categoria e valor. A lista de categorias vive numa constante do backend até existir a tela de Configurações.
4. **Base estimada** = rendimentos − despesas que entram, **nunca abaixo de zero** (base negativa mostra R$ 0,00). O service devolve também os totais brutos.
5. **Só meses encerrados.** Mês corrente, futuro ou anterior a 2000: 422 `MONTH_NOT_ENDED` ou 400 `INVALID_MONTH` (como no Fechamento); padrão no frontend é o mês anterior.
6. **Prazo.** Último dia útil do mês seguinte (sábado e domingo ficam de fora; feriados não são considerados), calculado no backend como `due_date` (AAAA-MM-DD).
7. **Faixa de estado.** O frontend consulta `GET /closings?month=`: fechado mostra "{Mês} está fechado." com o prazo e o aviso do canvas; aberto mostra "{Mês} ainda não foi fechado. Feche o mês para conferir antes de enviar ao contador." com link para o Fechamento; falha da consulta omite a faixa e mantém o aviso do cálculo. Os números **não** usam o retrato do Fechamento (que é por vencimento).
8. **Rótulos de unidade** no frontend (junta `/properties`), como em Por imóvel.
9. **Exportações.** Planilha = `GET /api/reports/carne-leao?mes=` (CSV UTF-8 com BOM, `;`, vírgula decimal, seções Rendimentos e Despesas e linha de base); contador = `PrintButton` com estilos de impressão. O card Carnê-leão e DIRPF entra no hub como primeiro card, com `?mes=` do mês anterior.
10. **Tela.** Navegação de mês (anterior e próximo, limitada ao último mês encerrado), celular com os mesmos blocos empilhados e listas em cards.

## Risks / Trade-offs

- Categorias fixas podem não coincidir com o que o contador deduz; o texto "Confirme com seu contador o que pode ser deduzido" fica na tela.
- Prazo sem feriados pode divergir em um dia útil; o texto diz "prazo estimado".
- Valores por data de pagamento divergem do Fechamento (por vencimento); a faixa não promete que são iguais.

## Migration Plan

Sem migration. Rollback: reverter os commits; o hub volta a ter só dois cards.

## Open Questions

Nenhuma bloqueante.

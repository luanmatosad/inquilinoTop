# reports-overview Specification

## Purpose
TBD - created by archiving change relatorios-visao-geral. Update Purpose after archive.
## Requirements
### Requirement: Totais e série mensal do ano
O sistema SHALL calcular, para um ano e por organização, o recebido (aluguéis pagos por data de pagamento, valor líquido), as despesas pagas (por data de pagamento) e o resultado, mês a mês, de janeiro até o último mês completo em São Paulo (anos passados: 12 meses). Ano futuro SHALL dar 400 `INVALID_YEAR`.

#### Scenario: Ano corrente em novembro
- **WHEN** hoje é 08/11/2026 e o dono pede 2026
- **THEN** a série vai de janeiro a outubro, com `through_month` igual a 10

#### Scenario: Pagamento em outro mês
- **WHEN** um aluguel com vencimento em 05/09 foi pago em 02/10
- **THEN** o valor entra no recebido de outubro

#### Scenario: Janeiro
- **WHEN** hoje é 15/01 e o dono pede o ano corrente
- **THEN** a série vem vazia e os totais zerados

#### Scenario: Outra organização
- **WHEN** outra organização consulta o mesmo ano
- **THEN** não vê os valores da primeira

### Requirement: Hub de relatórios
O frontend SHALL mostrar em `/reports` o seletor de ano, os indicadores Recebido no ano, Despesas e Resultado, o gráfico mensal de Recebido e Despesas e os cards Resultado por imóvel e Inadimplência (que leva a Recebimentos com as atrasadas), no desktop e no celular (sem gráfico).

#### Scenario: Abrir o hub
- **WHEN** o dono abre Relatórios
- **THEN** vê os números do ano corrente até o último mês completo

#### Scenario: Falha do backend
- **WHEN** a consulta falha
- **THEN** a tela mostra "Não foi possível carregar os relatórios" e a opção de tentar de novo


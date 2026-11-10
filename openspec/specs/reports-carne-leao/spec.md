# reports-carne-leao Specification

## Purpose
TBD - created by archiving change relatorios-carne-leao. Update Purpose after archive.
## Requirements
### Requirement: Carnê-leão do mês
O sistema SHALL calcular, para um mês encerrado e por organização, os rendimentos de aluguel (aluguéis pagos no mês, por data de pagamento, valor líquido, de inquilinos pessoa física, com pagador, unidade, data e valor), as despesas que entram (categorias Impostos e Condomínio pagas no mês, com descrição, unidade, categoria e valor), a base estimada (rendimentos menos despesas, nunca abaixo de zero) e o prazo (último dia útil do mês seguinte). Mês corrente ou futuro SHALL dar 422 `MONTH_NOT_ENDED` e mês inválido 400 `INVALID_MONTH`.

#### Scenario: Outubro
- **WHEN** há 5 aluguéis de pessoa física pagos em outubro (8.300) e 2 despesas de Condomínio e IPTU pagas em outubro (1.100)
- **THEN** a base estimada é 7.200 e o prazo é 30/11/2026

#### Scenario: Pagador pessoa jurídica
- **WHEN** um aluguel de outubro foi pago por inquilino pessoa jurídica
- **THEN** ele não entra nos rendimentos

#### Scenario: Categoria que não entra
- **WHEN** uma despesa de Manutenção foi paga em outubro
- **THEN** ela não entra nas despesas do carnê

#### Scenario: Base negativa
- **WHEN** as despesas que entram superam os rendimentos
- **THEN** a base estimada é 0

#### Scenario: Mês corrente
- **WHEN** o dono pede o mês corrente
- **THEN** o sistema responde 422 `MONTH_NOT_ENDED`

#### Scenario: Outra organização
- **WHEN** outra organização consulta o mesmo mês
- **THEN** não vê os pagamentos nem as despesas da primeira

### Requirement: Tela do carnê-leão
O frontend SHALL oferecer `/reports/carne-leao?mes=AAAA-MM` (padrão: mês anterior) com a faixa de estado do mês, os totais Rendimentos de aluguel, Despesas que entram e Base de cálculo (estimada), as listas Quem pagou e Despesas que entram, a navegação de mês limitada ao último mês encerrado e o aviso de que o cálculo do imposto é do programa da Receita ou do contador, no desktop e no celular; o hub de Relatórios SHALL ganhar o card Carnê-leão e DIRPF.

#### Scenario: Mês fechado
- **WHEN** o dono abre outubro e o mês está fechado
- **THEN** a faixa diz "Outubro está fechado" e mostra o prazo

#### Scenario: Mês aberto
- **WHEN** o mês ainda não foi fechado
- **THEN** a faixa avisa e leva ao Fechamento

#### Scenario: Falha
- **WHEN** a consulta do carnê falha
- **THEN** a tela mostra "Não foi possível carregar o relatório" com a opção de tentar de novo

### Requirement: Exportar o carnê-leão
O frontend SHALL oferecer **Baixar para o contador** (impressão do navegador, "Salvar como PDF") e **Exportar planilha**, um CSV (UTF-8 com BOM, separador `;`, vírgula decimal) com os rendimentos, as despesas e a base.

#### Scenario: Planilha
- **WHEN** o dono escolhe Exportar planilha
- **THEN** baixa `carne-leao-AAAA-MM.csv` com as duas listas e a base


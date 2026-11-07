## ADDED Requirements

### Requirement: Linhas da lista de contratos
O frontend SHALL montar cada linha da lista juntando o contrato ao nome do inquilino e ao nome da unidade e do imóvel, usando o `unit_id` do contrato nas unidades dos imóveis.

#### Scenario: Linha completa
- **WHEN** o contrato aponta para o inquilino "Marina Souza" e para a unidade "Apartamento 302" do imóvel "Ed. Aurora"
- **THEN** a linha traz esses três nomes

#### Scenario: Unidade ausente
- **WHEN** a unidade do contrato não está na lista de imóveis
- **THEN** a linha aparece com "—" no lugar da unidade e do imóvel, sem erro

#### Scenario: Inquilino ausente
- **WHEN** o inquilino do contrato não está na lista de inquilinos
- **THEN** a linha aparece com "—" no lugar do nome, sem erro

### Requirement: Indicadores dos contratos
O frontend SHALL calcular os indicadores a partir dos contratos: Ativos (contagem e soma do `rent_amount` dos `ACTIVE`), Vencendo em 30 dias (`ACTIVE` com `end_date` entre hoje e daqui a 30 dias, inclusive), Reajuste em 90 dias (`ACTIVE` com `next_readjustment` do início do mês corrente até daqui a 90 dias, inclusive, de modo que o reajuste do mês corrente conta) e Encerrados (`ENDED`), considerando "hoje" no fuso `America/Sao_Paulo`.

#### Scenario: Soma do aluguel
- **WHEN** os contratos ativos têm aluguéis de 1850, 1600, 1550, 2200 e 1100
- **THEN** Ativos mostra 5 e a soma R$ 8.300,00

#### Scenario: Contratos encerrados e cancelados
- **WHEN** há contratos `ENDED` e `CANCELED`
- **THEN** só os `ENDED` contam em Encerrados e nenhum deles entra em Ativos

#### Scenario: Fronteira dos 30 dias
- **WHEN** um contrato ativo termina exatamente daqui a 30 dias e outro daqui a 31
- **THEN** só o primeiro conta em Vencendo em 30 dias

#### Scenario: Contrato aberto
- **WHEN** o contrato ativo não tem `end_date`
- **THEN** ele não conta em Vencendo em 30 dias

#### Scenario: Reajuste do mês corrente
- **WHEN** hoje é 07/11/2026 e o `next_readjustment` de um contrato ativo é 2026-11-01
- **THEN** o contrato conta em Reajuste em 90 dias e não é marcado como pendente

#### Scenario: Reajuste de um mês anterior
- **WHEN** o `next_readjustment` de um contrato ativo é de um mês anterior ao corrente
- **THEN** o contrato não conta em Reajuste em 90 dias e a linha é marcada como pendente

#### Scenario: Fronteira dos 90 dias
- **WHEN** um contrato ativo tem `next_readjustment` daqui a 90 dias e outro daqui a 91
- **THEN** só o primeiro conta em Reajuste em 90 dias

#### Scenario: Virada do mês
- **WHEN** são 23h do último dia do mês em São Paulo, já sendo o mês seguinte em UTC
- **THEN** "hoje" continua sendo o dia de São Paulo

### Requirement: Conversão de juros mensal e diário
O frontend SHALL converter juros de porcentagem ao mês para porcentagem ao dia dividindo por 30 (seis casas decimais) e de porcentagem ao dia para ao mês multiplicando por 30 (duas casas decimais).

#### Scenario: Ida
- **WHEN** o usuário informa 1% ao mês
- **THEN** o valor diário é 0,033333

#### Scenario: Volta
- **WHEN** o valor diário é 0,033333
- **THEN** o valor mensal exibido é 1,00

#### Scenario: Ida e volta sem deriva
- **WHEN** o usuário informa 2,5% ao mês, converte para diário e de volta
- **THEN** o resultado é 2,50

#### Scenario: Zero e vazio
- **WHEN** o valor é 0 ou vazio
- **THEN** a conversão devolve 0

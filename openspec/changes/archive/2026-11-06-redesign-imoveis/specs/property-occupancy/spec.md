## ADDED Requirements

### Requirement: Situação da unidade
O frontend SHALL classificar cada unidade como alugada quando existe contrato com `status` `ACTIVE` ligado a ela, e como vaga caso contrário. Contratos `ENDED` e `CANCELED` SHALL NOT tornar a unidade alugada.

#### Scenario: Contrato ativo
- **WHEN** a unidade tem um contrato `ACTIVE`
- **THEN** a situação é "Alugada"

#### Scenario: Contrato encerrado
- **WHEN** a unidade só tem contratos `ENDED` ou `CANCELED`
- **THEN** a situação é "Vaga"

#### Scenario: Sem contrato
- **WHEN** a unidade não tem contrato
- **THEN** a situação é "Vaga" e não há inquilino

### Requirement: Inquilino atual da unidade
O frontend SHALL mostrar, para unidade alugada, o nome do inquilino do contrato ativo e a data de início do contrato.

#### Scenario: Nome e início
- **WHEN** o contrato ativo tem `tenant_id` de "Marina Souza" e `start_date` 2025-03-10
- **THEN** a unidade mostra "Marina Souza" e "desde 03/2025"

#### Scenario: Mais de um contrato ativo
- **WHEN** a mesma unidade tem dois contratos `ACTIVE`
- **THEN** vale o de `start_date` mais recente

#### Scenario: Inquilino não encontrado
- **WHEN** o contrato ativo aponta para um `tenant_id` que não está na lista de inquilinos
- **THEN** a unidade aparece como "Alugada" sem nome de inquilino e sem erro

### Requirement: Indicadores de ocupação
O frontend SHALL exibir no topo da lista de imóveis os indicadores Imóveis (quantidade), Unidades (quantidade e número de imóveis), Alugadas (de quantas unidades) e Vagas (unidades sem contrato ativo).

#### Scenario: Totais
- **WHEN** há 5 imóveis com 14 unidades, 5 alugadas
- **THEN** os indicadores mostram 5, 14 em 5 imóveis, 5 de 14 e 9

#### Scenario: Sem imóveis
- **WHEN** a organização não tem imóveis
- **THEN** a tela mostra o estado vazio e não mostra os indicadores

### Requirement: Ocupação indisponível
O frontend SHALL continuar mostrando a lista de imóveis quando a busca de contratos ou de inquilinos falhar, sinalizando que a ocupação está indisponível, e SHALL tratar a falha da lista de imóveis como erro da tela.

#### Scenario: Contratos fora do ar
- **WHEN** a busca de contratos falha e a de imóveis funciona
- **THEN** a lista aparece com Ocupação "—", os indicadores Alugadas e Vagas não aparecem e um aviso informa que a ocupação está indisponível

#### Scenario: Imóveis fora do ar
- **WHEN** a busca de imóveis falha
- **THEN** a tela mostra o erro com a ação "Tentar novamente"

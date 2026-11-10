## ADDED Requirements

### Requirement: Regras financeiras da organização
O sistema SHALL guardar por organização a multa por atraso (0 a 10%), os juros ao mês (0 a 5%), o índice de reajuste padrão (`IGP-M` ou `IPCA`) e os dias de aviso do reajuste (1 a 180), expondo `GET /settings/financial-rules` (permissão de leitura da organização) e `PUT /settings/financial-rules` (permissão de atualização). Sem configuração gravada, `GET` SHALL devolver 2%, 1%, `IGP-M` e 60 dias. Valor fora da faixa SHALL dar 400 `INVALID_RULES`.

#### Scenario: Sem configuração
- **WHEN** uma organização nova consulta as regras
- **THEN** recebe 2, 1, `IGP-M` e 60

#### Scenario: Salvar
- **WHEN** o dono grava multa 2,5, juros 1, índice `IPCA` e aviso 45
- **THEN** a consulta seguinte devolve exatamente esses valores

#### Scenario: Fora da faixa
- **WHEN** o dono grava multa 15
- **THEN** a resposta é 400 `INVALID_RULES` e nada muda

#### Scenario: Outra organização
- **WHEN** outra organização consulta as regras
- **THEN** não vê as da primeira

### Requirement: Valores antigos aproveitados
A migration SHALL copiar `default_late_fee` e `default_interest` de `financial_config.config` para as regras, somente quando forem números dentro das faixas permitidas.

#### Scenario: Valor antigo válido
- **WHEN** a organização tinha `default_late_fee` 3
- **THEN** as regras começam com multa 3

#### Scenario: Valor antigo inválido
- **WHEN** a organização tinha `default_interest` "abc"
- **THEN** os juros começam no padrão 1

### Requirement: Tela de regras financeiras
O frontend SHALL oferecer `/settings/rules` com multa, juros ao mês, índice padrão e dias de aviso do reajuste, validando as mesmas faixas, avisando que os valores valem para novos contratos e que o aviso aparece em Hoje. O bloco "Padrões de Cobrança" SHALL sair de Recebimento (Pix).

#### Scenario: Editar e salvar
- **WHEN** o dono altera a multa e salva
- **THEN** vê a confirmação e a tela mantém o novo valor

#### Scenario: Valor inválido
- **WHEN** o dono informa juros 8
- **THEN** a tela mostra o erro e não envia

### Requirement: Padrões no novo contrato
O formulário de novo contrato SHALL vir preenchido com a multa, os juros e o índice das regras; a edição de um contrato SHALL continuar mostrando os valores do próprio contrato. Se as regras não puderem ser lidas, o formulário SHALL usar 2%, 1% e nenhum índice.

#### Scenario: Novo contrato
- **WHEN** as regras têm multa 3 e o dono abre Novo contrato
- **THEN** a multa já vem como 3

#### Scenario: Regras indisponíveis
- **WHEN** a busca das regras falha
- **THEN** o formulário abre com 2, 1 e sem índice, sem erro na tela

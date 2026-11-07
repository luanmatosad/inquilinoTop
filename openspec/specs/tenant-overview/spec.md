# tenant-overview Specification

## Purpose
Visão geral por inquilino, derivada de inquilinos, contratos, imóveis e pagamentos: contrato atual, imóvel e unidade e situação de cobrança do mês.

## Requirements
### Requirement: Contrato atual do inquilino
O frontend SHALL considerar contrato atual de um inquilino o contrato com `status` `ACTIVE` e `start_date` mais recente, e SHALL tratar como "Sem contrato" o inquilino que não tem nenhum.

#### Scenario: Contrato ativo
- **WHEN** o inquilino tem um contrato `ACTIVE`
- **THEN** esse é o contrato atual

#### Scenario: Mais de um contrato ativo
- **WHEN** o inquilino tem dois contratos `ACTIVE`
- **THEN** vale o de `start_date` mais recente

#### Scenario: Só contratos encerrados
- **WHEN** o inquilino só tem contratos `ENDED` ou `CANCELED`
- **THEN** a situação é "Sem contrato"

### Requirement: Imóvel e unidade do inquilino
O frontend SHALL mostrar, para o contrato atual, o nome da unidade e o nome do imóvel a que ela pertence, no formato "Unidade · Imóvel".

#### Scenario: Unidade e imóvel
- **WHEN** o contrato atual aponta para a unidade "Ap 302" do imóvel "Ed. Aurora"
- **THEN** o texto é "Ap 302 · Ed. Aurora"

#### Scenario: Unidade não encontrada
- **WHEN** a unidade do contrato não está na lista de imóveis
- **THEN** o inquilino aparece com contrato, sem nome de unidade e sem erro

### Requirement: Situação de cobrança do mês
O frontend SHALL derivar a situação de cobrança do inquilino na ordem: sem contrato atual → "Sem contrato"; qualquer pagamento `LATE` de contrato ativo do inquilino → "Atrasado"; pagamento de aluguel (`RENT`) do mês corrente `PAID` → "Pago"; `PENDING` → "Previsto"; sem pagamento no mês → sem situação, exibida como "—". O mês corrente SHALL ser calculado no fuso `America/Sao_Paulo`.

#### Scenario: Atrasado vence qualquer outro estado
- **WHEN** o inquilino tem um pagamento `LATE` de outro mês e o aluguel do mês corrente `PAID`
- **THEN** a situação é "Atrasado"

#### Scenario: Pago
- **WHEN** o aluguel do mês corrente está `PAID` e não há pagamento `LATE`
- **THEN** a situação é "Pago"

#### Scenario: Previsto
- **WHEN** o aluguel do mês corrente está `PENDING`
- **THEN** a situação é "Previsto"

#### Scenario: Sem pagamento no mês
- **WHEN** o inquilino tem contrato ativo e nenhum pagamento no mês corrente
- **THEN** a situação é "—"

#### Scenario: Virada do mês
- **WHEN** são 23h do último dia do mês em São Paulo, já sendo o mês seguinte em UTC
- **THEN** o mês corrente continua sendo o de São Paulo

#### Scenario: Só aluguel conta para Pago e Previsto
- **WHEN** o mês corrente tem um pagamento `EXPENSE` `PAID` e o aluguel `PENDING`
- **THEN** a situação é "Previsto"

### Requirement: Dados indisponíveis
O frontend SHALL continuar mostrando a lista de inquilinos quando as buscas de contratos, imóveis ou pagamentos falharem, exibindo "—" nos campos afetados e um aviso discreto, e SHALL tratar a falha da busca de inquilinos como erro da tela.

#### Scenario: Pagamentos fora do ar
- **WHEN** a busca de pagamentos falha e as demais funcionam
- **THEN** a coluna Cobrança do mês mostra "—" para todos e um aviso informa que a cobrança está indisponível

#### Scenario: Contratos fora do ar
- **WHEN** a busca de contratos falha
- **THEN** as colunas Imóvel e unidade e Cobrança do mês mostram "—" e um aviso informa a indisponibilidade

#### Scenario: Inquilinos fora do ar
- **WHEN** a busca de inquilinos falha
- **THEN** a tela mostra o erro com a ação "Tentar novamente"

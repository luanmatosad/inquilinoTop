# accounts-receivable Specification

## Purpose
TBD - created by archiving change mvp-contas-pagar-receber. Update Purpose after archive.
## Requirements
### Requirement: Filtros e resumo de contas a receber
O sistema SHALL listar cobranças filtrando por `status`, período de vencimento (`from`, `to`) e contrato, sempre limitadas à organização, e SHALL retornar o resumo de valor e quantidade a vencer, vencidos (com multa e juros) e recebidos no período.

#### Scenario: Filtro por período e status
- **WHEN** o usuário filtra `status=PENDING` com `from` e `to`
- **THEN** recebe só cobranças pendentes com vencimento no período, inclusive nas extremidades

#### Scenario: Cobrança vencida
- **WHEN** a cobrança `PENDING` tem vencimento anterior a hoje
- **THEN** a listagem a retorna como `LATE` com multa e juros calculados conforme o contrato

#### Scenario: Resumo do período
- **WHEN** o usuário consulta `GET /api/v1/payments/summary` de um período
- **THEN** recebe valor e quantidade de a vencer, vencidos (total atualizado) e recebidos

#### Scenario: Rota de resumo
- **WHEN** o cliente chama `/payments/summary`
- **THEN** a resposta é o resumo e não é tratada como id de cobrança

#### Scenario: Outra organização
- **WHEN** o usuário consulta cobranças
- **THEN** nunca recebe cobranças de outra organização

### Requirement: Baixa manual de recebível
O sistema SHALL permitir marcar cobrança como paga informando a data e, opcionalmente, a forma de pagamento (`PIX`, `CASH`, `TRANSFER`, `BOLETO`, `OTHER`), um desconto e uma observação, calculando multa, juros, IRRF e valor líquido, gravando o evento de pagamento e o número do recibo, e SHALL manter a cobrança imutável quanto a exclusão.

#### Scenario: Baixa em atraso
- **WHEN** o usuário dá baixa em cobrança vencida há 10 dias
- **THEN** o sistema grava `paid_date`, multa, juros e valor líquido e a cobrança vira `PAID`

#### Scenario: Forma e observação
- **WHEN** o usuário dá baixa informando forma `CASH` e a observação "pagou na portaria"
- **THEN** a cobrança guarda a forma e a observação

#### Scenario: Desconto
- **WHEN** a cobrança devida é R$ 1.850,00 e o usuário informa desconto de R$ 50,00
- **THEN** o valor líquido considera o desconto (R$ 1.800,00, sem IRRF) e o desconto fica registrado

#### Scenario: Desconto maior que o devido
- **WHEN** o desconto é maior que o valor devido
- **THEN** o sistema retorna 400

#### Scenario: IRRF sobre o valor pago
- **WHEN** o inquilino é PJ e há desconto
- **THEN** a base do IRRF é o valor devido menos o desconto

#### Scenario: Evento de pagamento
- **WHEN** a baixa é gravada
- **THEN** a linha do tempo ganha o evento de pagamento com data, valor e forma

#### Scenario: Cobrança paga
- **WHEN** o usuário tenta dar baixa em cobrança já `PAID`
- **THEN** o sistema retorna 409

#### Scenario: Exclusão
- **WHEN** o usuário tenta excluir uma cobrança
- **THEN** a operação não existe na API

### Requirement: Recibo
O sistema SHALL emitir recibo para cobrança `PAID` com número sequencial por organização e ano (formato `0001/2026`), partes, unidade, valores, desconto, forma de pagamento e data de pagamento.

#### Scenario: Recibo de cobrança paga
- **WHEN** o usuário solicita o recibo de uma cobrança `PAID`
- **THEN** recebe número, proprietário, inquilino, unidade, valores, desconto e forma de pagamento

#### Scenario: Numeração sequencial
- **WHEN** duas cobranças da mesma organização são pagas em 2026
- **THEN** recebem os números 0001/2026 e 0002/2026, e o ano seguinte recomeça em 0001

#### Scenario: Número estável
- **WHEN** o recibo da mesma cobrança é pedido duas vezes
- **THEN** o número é o mesmo

#### Scenario: Cobrança paga antes da numeração
- **WHEN** o recibo de uma cobrança paga antes desta mudança é pedido pela primeira vez
- **THEN** o sistema atribui o próximo número da organização e o ano do pagamento

#### Scenario: Corrida de numeração
- **WHEN** duas cobranças da mesma organização são pagas ao mesmo tempo
- **THEN** os números são distintos

#### Scenario: Recibo de cobrança pendente
- **WHEN** a cobrança não está paga
- **THEN** o sistema retorna 409

### Requirement: Tela de contas a receber
O frontend SHALL exibir em `/financial/receivables` a tela Recebimentos, com navegação por mês, indicadores, chips de situação, ação de registrar pagamento e acesso ao recibo, conforme a capability `receivables-overview`, e SHALL NOT oferecer os filtros de período, contrato e status por formulário.

#### Scenario: Dar baixa na tela
- **WHEN** o usuário confirma o pagamento de uma cobrança no diálogo
- **THEN** a linha passa a "Pago", o recibo fica disponível e os totais são atualizados

#### Scenario: Recibo
- **WHEN** a cobrança está paga
- **THEN** a linha oferece o link Recibo para `/financial/receivables/<id>/receipt`

#### Scenario: Filtros antigos
- **WHEN** o usuário acessa a tela
- **THEN** não há formulário de período nem de contrato; o mês e a situação vêm de `?mes=` e `?situacao=`


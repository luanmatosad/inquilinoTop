## MODIFIED Requirements

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

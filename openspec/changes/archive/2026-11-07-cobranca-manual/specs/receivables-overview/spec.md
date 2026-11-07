## MODIFIED Requirements

### Requirement: Registrar pagamento
O frontend SHALL permitir registrar o pagamento de uma cobrança aberta pelo detalhe ou pelo botão do topo, com a data do pagamento, a forma de pagamento, um desconto opcional e uma observação opcional, e SHALL mostrar o valor atualizado com multa e juros quando a cobrança estiver atrasada e o saldo depois do desconto.

#### Scenario: Pelo detalhe
- **WHEN** o usuário aciona "Registrar pagamento" no detalhe de uma cobrança `PENDING`
- **THEN** o diálogo abre com essa cobrança escolhida, a data de hoje e a forma Pix

#### Scenario: Cobrança atrasada
- **WHEN** a cobrança está `LATE`
- **THEN** o diálogo mostra o valor bruto e o total atualizado com multa e juros

#### Scenario: Pelo topo
- **WHEN** o usuário aciona "Registrar pagamento" no topo
- **THEN** o diálogo lista as cobranças abertas para escolher

#### Scenario: Desconto e forma
- **WHEN** o usuário escolhe "Dinheiro" e informa desconto de R$ 50,00
- **THEN** o pedido leva a forma e o desconto, e o diálogo mostra o total a receber já com o abatimento

#### Scenario: Desconto inválido
- **WHEN** o desconto é maior que o total devido
- **THEN** o diálogo mostra o erro e não envia

#### Scenario: Sucesso
- **WHEN** a baixa é confirmada
- **THEN** a linha passa a Pago, com o link Recibo, e os indicadores se atualizam

## ADDED Requirements

### Requirement: Ações da linha e acesso ao detalhe
O frontend SHALL ligar o nome do inquilino de cada linha ao detalhe da cobrança e mostrar a ação do canvas: "Enviar cobrança" para Previsto, "Cobrar" para Atrasado e "Recibo" para Pago, sendo que "Enviar cobrança" e "Cobrar" levam ao envio no detalhe.

#### Scenario: Previsto
- **WHEN** a cobrança está Prevista
- **THEN** a linha mostra "Enviar cobrança" apontando para `?enviar=1` do detalhe

#### Scenario: Atrasado
- **WHEN** a cobrança está Atrasada
- **THEN** a linha mostra "Cobrar" apontando para `?enviar=1` do detalhe

#### Scenario: Pago
- **WHEN** a cobrança está Paga
- **THEN** a linha mostra "Recibo"

#### Scenario: Detalhe
- **WHEN** o usuário aciona o nome do inquilino
- **THEN** abre `/financial/receivables/<id>`

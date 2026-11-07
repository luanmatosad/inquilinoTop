## MODIFIED Requirements

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

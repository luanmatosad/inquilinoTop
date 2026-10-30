## ADDED Requirements

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
O sistema SHALL permitir marcar cobrança como paga informando a data, calculando multa, juros, IRRF e valor líquido, e SHALL manter a cobrança imutável quanto a exclusão.

#### Scenario: Baixa em atraso
- **WHEN** o usuário dá baixa em cobrança vencida há 10 dias
- **THEN** o sistema grava `paid_date`, multa, juros e valor líquido e a cobrança vira `PAID`

#### Scenario: Cobrança paga
- **WHEN** o usuário tenta dar baixa em cobrança já `PAID`
- **THEN** o sistema retorna 409

#### Scenario: Exclusão
- **WHEN** o usuário tenta excluir uma cobrança
- **THEN** a operação não existe na API

### Requirement: Recibo
O sistema SHALL emitir recibo para cobrança `PAID` com partes, unidade, valores e data de pagamento.

#### Scenario: Recibo de cobrança paga
- **WHEN** o usuário solicita o recibo de uma cobrança `PAID`
- **THEN** recebe proprietário, inquilino, unidade e valores

#### Scenario: Recibo de cobrança pendente
- **WHEN** a cobrança não está paga
- **THEN** o sistema retorna 409

### Requirement: Tela de contas a receber
O frontend SHALL exibir em `/financial/receivables` as cobranças com filtros de período, status e imóvel, cartões de totais, indicador de atraso, ação de dar baixa e acesso ao recibo.

#### Scenario: Dar baixa na tela
- **WHEN** o usuário confirma a baixa de uma cobrança no diálogo
- **THEN** a linha passa a "Pago", o recibo fica disponível e os totais são atualizados

#### Scenario: Atraso destacado
- **WHEN** a cobrança está vencida
- **THEN** a linha mostra o badge "Atrasado" e o total atualizado com multa e juros

#### Scenario: Menu enxuto
- **WHEN** o usuário abre o menu financeiro
- **THEN** vê Contas a Receber e Contas a Pagar, sem itens que não têm backend (conciliação, repasses, comissões)

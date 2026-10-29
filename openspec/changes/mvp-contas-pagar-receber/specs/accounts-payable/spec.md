## ADDED Requirements

### Requirement: Status e baixa de despesa
O sistema SHALL manter para cada despesa o status `PENDING` ou `PAID`, com `paid_date` e `paid_amount` quando paga, e SHALL exibir `LATE` para despesa `PENDING` com vencimento anterior à data atual.

#### Scenario: Nova despesa
- **WHEN** o usuário cria uma despesa
- **THEN** ela nasce `PENDING`, sem data nem valor pago

#### Scenario: Despesa vencida
- **WHEN** a despesa `PENDING` tem `due_date` anterior a hoje
- **THEN** a listagem a retorna com status `LATE`

#### Scenario: Baixa com valor padrão
- **WHEN** o usuário dá baixa informando só `paid_date`
- **THEN** o status vira `PAID` e `paid_amount` é igual a `amount`

#### Scenario: Baixa com valor diferente
- **WHEN** o usuário informa `paid_amount` diferente de `amount`
- **THEN** o sistema registra o valor informado, arredondado a 2 casas

#### Scenario: Baixa repetida
- **WHEN** o usuário dá baixa em despesa já `PAID`
- **THEN** o sistema retorna 409 `EXPENSE_ALREADY_PAID`

### Requirement: Estornar baixa
O sistema SHALL permitir desfazer a baixa, voltando a despesa para `PENDING` e limpando data e valor pagos, com registro de auditoria.

#### Scenario: Estorno
- **WHEN** o usuário estorna uma despesa `PAID`
- **THEN** ela volta a `PENDING`, `paid_date` e `paid_amount` ficam vazios e um registro de auditoria é criado

#### Scenario: Estorno de pendente
- **WHEN** a despesa já está `PENDING`
- **THEN** o sistema retorna 409

### Requirement: Despesa paga protegida
O sistema SHALL rejeitar alteração de valor e vencimento em despesa `PAID`, permitindo alterar descrição e categoria.

#### Scenario: Mudança de valor
- **WHEN** o usuário atualiza `amount` de uma despesa `PAID`
- **THEN** o sistema retorna 409 `EXPENSE_LOCKED`

#### Scenario: Mudança de descrição
- **WHEN** o usuário atualiza só a descrição de uma despesa `PAID`
- **THEN** o sistema aceita a alteração

### Requirement: Filtros e resumo de contas a pagar
O sistema SHALL listar despesas filtrando por `status`, período de vencimento (`from`, `to`) e unidade, sempre limitadas à organização, e SHALL retornar o resumo de valor e quantidade a vencer, vencidos e pagos no período.

#### Scenario: Filtro por atraso
- **WHEN** o usuário filtra `status=LATE`
- **THEN** recebe somente despesas `PENDING` já vencidas

#### Scenario: Filtro por período
- **WHEN** o usuário informa `from` e `to`
- **THEN** recebe despesas com vencimento dentro do período, inclusive nas extremidades

#### Scenario: Resumo
- **WHEN** o usuário consulta o resumo de um período com 2 despesas a vencer, 1 vencida e 1 paga
- **THEN** o resumo traz as três categorias com seus totais e quantidades

#### Scenario: Lista vazia
- **WHEN** nenhuma despesa atende aos filtros
- **THEN** a resposta é `[]`

### Requirement: Tela de contas a pagar
O frontend SHALL exibir em `/financial/payables` a lista de despesas com filtros de período, status e imóvel, cartões de totais, indicador de atraso e ação de dar baixa com data e valor.

#### Scenario: Dar baixa
- **WHEN** o usuário confirma a baixa de uma despesa no diálogo
- **THEN** a linha passa a "Pago" e os totais são atualizados

#### Scenario: Baixa em lote
- **WHEN** o usuário seleciona várias despesas pendentes e informa uma data de pagamento
- **THEN** todas são baixadas e as falhas, se houver, são listadas

#### Scenario: Estados da tela
- **WHEN** a lista carrega, está vazia ou falha
- **THEN** a tela mostra carregamento, estado vazio com ação de lançar despesa e erro com nova tentativa

## MODIFIED Requirements

### Requirement: Tela de contas a pagar
O frontend SHALL exibir em `/financial/payables` a tela Despesas, com navegação por mês, indicadores, chips de situação, painel de lançar despesa e ação de dar baixa e de desfazer o pagamento, conforme a capability `payables-overview`, e SHALL NOT oferecer baixa em lote nem os filtros de período e unidade por formulário.

#### Scenario: Dar baixa
- **WHEN** o usuário confirma a baixa de uma despesa no diálogo
- **THEN** a linha passa a "Paga" e os totais são atualizados

#### Scenario: Estados da tela
- **WHEN** a lista carrega, está vazia ou falha
- **THEN** a tela mostra carregamento, estado vazio com ação de lançar despesa e erro com nova tentativa

## ADDED Requirements

### Requirement: Despesa criada já paga
O sistema SHALL aceitar `paid_date` opcional ao criar uma despesa e, quando informado, criá-la `PAID` com `paid_date` e `paid_amount` igual ao valor, numa única operação.

#### Scenario: Criada já paga
- **WHEN** o usuário cria uma despesa de R$ 800,00 com `paid_date` 2026-11-02
- **THEN** a resposta traz `status` `PAID`, `paid_date` 2026-11-02 e `paid_amount` 800,00

#### Scenario: Sem data de pagamento
- **WHEN** `paid_date` não é enviado
- **THEN** a despesa nasce pendente como antes

#### Scenario: Data no futuro
- **WHEN** `paid_date` é posterior a hoje
- **THEN** o sistema retorna 400 e não cria a despesa

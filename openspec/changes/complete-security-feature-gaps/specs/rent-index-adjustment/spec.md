# Spec Delta

## Purpose

Reajuste anual de aluguel por índice oficial (IPCA ou IGP-M), com aviso prévio ao owner e confirmação manual antes de aplicar o novo valor ao contrato.

## ADDED Requirements

### Requirement: Índices oficiais disponíveis por consulta
O sistema SHALL expor os valores de IPCA e IGP-M por período, armazenados em `index_values`.

#### Scenario: Consulta de índice por período
- **WHEN** o owner consulta IPCA entre dois meses
- **THEN** o sistema retorna os valores armazenados desse intervalo, ordenados por mês

#### Scenario: Índice indisponível na fonte
- **WHEN** a fonte externa falha ao atualizar
- **THEN** os valores existentes permanecem e a falha gera notificação ao owner

### Requirement: Aviso 30 dias antes do reajuste
O sistema SHALL notificar o owner 30 dias antes da data de reajuste de cada contrato ativo.

#### Scenario: Aviso gerado
- **WHEN** faltam 30 dias para a data de reajuste de um contrato ativo
- **THEN** uma notificação de reajuste é enfileirada uma única vez para aquele contrato

### Requirement: Reajuste exige confirmação manual
O sistema SHALL aplicar o valor reajustado ao contrato somente após confirmação explícita do owner.

#### Scenario: Confirmação aplica o reajuste
- **WHEN** o owner confirma o reajuste calculado
- **THEN** o novo valor passa a valer no contrato a partir da data de reajuste

#### Scenario: Sem confirmação o valor não muda
- **WHEN** a data de reajuste passa sem confirmação
- **THEN** o valor do contrato permanece inalterado

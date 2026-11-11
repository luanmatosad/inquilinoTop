# Spec Delta

## Purpose

Registro de toda mutação de dados bem-sucedida em `audit_logs`, para rastrear quem alterou o quê, sem expor segredos.

## ADDED Requirements

### Requirement: Mutações bem-sucedidas são auditadas
O sistema SHALL gravar um registro em `audit_logs` para cada requisição POST, PUT, PATCH ou DELETE que retorne 2xx.

#### Scenario: Criação registrada
- **WHEN** um usuário cria um recurso com sucesso
- **THEN** existe um registro de auditoria com usuário, ação, recurso e data

#### Scenario: Requisição com erro não é auditada
- **WHEN** uma mutação retorna 4xx ou 5xx
- **THEN** nenhum registro de auditoria de mutação é gravado

### Requirement: Segredos não entram na auditoria
O sistema SHALL NOT gravar corpo de requisição que contenha senha, token ou código 2FA.

#### Scenario: Troca de senha auditada sem segredo
- **WHEN** um usuário altera a senha
- **THEN** o registro de auditoria existe e não contém a senha nova nem a antiga

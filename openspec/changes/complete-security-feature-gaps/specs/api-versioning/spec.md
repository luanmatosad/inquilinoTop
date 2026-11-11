# Spec Delta

## Purpose

Coexistência de `/api/v1/` e `/api/v2/` durante a migração, com header que informa a versão servida em cada resposta.

## ADDED Requirements

### Requirement: v1 e v2 coexistem
O sistema SHALL servir `/api/v1/` sem alteração de contrato enquanto `/api/v2/` estiver disponível.

#### Scenario: Rota v1 inalterada
- **WHEN** um cliente chama uma rota de `/api/v1/` existente
- **THEN** a resposta mantém o mesmo contrato de antes da mudança

#### Scenario: Rota v2 disponível
- **WHEN** um cliente chama a mesma operação em `/api/v2/`
- **THEN** a resposta tem o mesmo corpo e status que a versão v1 correspondente

### Requirement: Header de versão nas respostas
O sistema SHALL incluir o header `X-API-Version` com a versão servida em toda resposta de `/api/v1/` e `/api/v2/`.

#### Scenario: Header presente
- **WHEN** qualquer rota versionada responde
- **THEN** a resposta contém `X-API-Version` com `1` ou `2` conforme a rota chamada

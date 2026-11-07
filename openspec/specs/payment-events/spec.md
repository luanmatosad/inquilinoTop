# payment-events Specification

## Purpose
TBD - created by archiving change cobranca-manual. Update Purpose after archive.
## Requirements
### Requirement: Linha do tempo da cobrança
O sistema SHALL devolver, em `GET /api/v1/payments/{id}/events`, a linha do tempo da cobrança em ordem cronológica, somando os eventos gravados (`SENT`, `REMINDER`, `AGREEMENT`, `PAID`) aos marcos calculados Criada (a partir de `created_at`) e Venceu em (quando a cobrança está vencida e não paga), sempre limitada à organização.

#### Scenario: Cobrança recém-criada
- **WHEN** a cobrança foi gerada pelo contrato e nada aconteceu
- **THEN** a linha do tempo traz só o marco Criada

#### Scenario: Cobrança atrasada
- **WHEN** a cobrança venceu em 25/10, foi enviada em 02/10 e tem um lembrete em 30/10
- **THEN** a linha do tempo traz Criada, Enviada, Venceu em 25/10 e Lembrete, em ordem de data

#### Scenario: Cobrança paga
- **WHEN** a cobrança foi paga
- **THEN** a linha do tempo traz o evento de pagamento com a data, o valor e a forma

#### Scenario: Outra organização
- **WHEN** o usuário pede os eventos de uma cobrança de outra organização
- **THEN** o sistema retorna 404

### Requirement: Registrar envio da cobrança
O sistema SHALL aceitar `POST /api/v1/payments/{id}/events` com `kind` `SENT` ou `REMINDER` e `channel` `WHATSAPP`, `EMAIL` ou `COPY`, gravando o evento com o usuário e o horário, e SHALL recusar qualquer outro `kind`.

#### Scenario: Marcar como enviada
- **WHEN** o usuário registra `SENT` por `WHATSAPP`
- **THEN** o sistema grava o evento e ele aparece na linha do tempo

#### Scenario: Tipo não permitido
- **WHEN** o usuário envia `kind` `PAID`
- **THEN** o sistema retorna 400 e não grava nada

#### Scenario: Cobrança paga
- **WHEN** o usuário registra um envio numa cobrança já `PAID`
- **THEN** o sistema retorna 409

### Requirement: Eventos imutáveis
O sistema SHALL NOT oferecer edição nem exclusão de eventos da cobrança.

#### Scenario: Sem alteração
- **WHEN** o cliente tenta editar ou excluir um evento
- **THEN** a operação não existe na API


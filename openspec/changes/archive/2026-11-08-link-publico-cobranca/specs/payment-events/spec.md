## MODIFIED Requirements

### Requirement: Linha do tempo da cobrança
O sistema SHALL devolver, em `GET /api/v1/payments/{id}/events`, a linha do tempo da cobrança em ordem cronológica, somando os eventos gravados (`SENT`, `REMINDER`, `AGREEMENT`, `REPORTED`, `REJECTED`, `PAID`) aos marcos calculados Criada (a partir de `created_at`) e Venceu em (quando a cobrança está vencida e não paga), sempre limitada à organização. `REPORTED` e `REJECTED` SHALL ser gravados somente pelo sistema.

#### Scenario: Aviso do inquilino
- **WHEN** o inquilino avisou que pagou
- **THEN** a linha do tempo traz o evento "Inquilino avisou que pagou" com valor e data informados

#### Scenario: Aviso recusado
- **WHEN** o dono recusou o aviso
- **THEN** a linha do tempo traz "Aviso recusado" depois do aviso

#### Scenario: Tipo reservado
- **WHEN** o usuário envia `kind` `REPORTED` em `POST /payments/{id}/events`
- **THEN** o sistema retorna 400 e não grava nada

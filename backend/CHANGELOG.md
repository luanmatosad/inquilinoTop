# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rate indexation support for leases (`index_values` table and endpoints)
- API v2 versioning support (accessible via `/api/v2` with `API-Version` header)
- Graceful shutdown for the API server
- `POST /api/v1/organizations`: usuário cria a própria organização como owner; 409 `ALREADY_HAS_ORG` se já for membro de uma
- E-mail de convite enfileirado via `notification.Service.CreateNotification` ao criar convite; link `<APP_PUBLIC_URL>/invite/accept?token=...`. Falha de enqueue só loga (sem reenvio)
- Notificação que atinge `MaxRetries = 5` vai para o status `failed` (migration 000062 adiciona o status ao CHECK)
- Tela `/invite/accept` no frontend (aceite automático ao montar; 409 `ALREADY_HAS_ORG` tratado na UI)
- Swagger do `GET /api/v1/organizations/me/membership`

### Changed
- `GET /api/v1/audit-logs` passa a exigir role `owner` (403 `FORBIDDEN` para os demais)
- Papel de acesso revalidado a cada requisição protegida contra `organization_members`; role do JWT removido do contexto (`RoleFromCtx`, `WithRole`, `WithOwnerIDOrgIDRole`)
- Uma organização por usuário (owner ou membro): índice único `uq_org_members_one_org_per_user` em `organization_members(user_id)` (migration 000060; substitui o parcial `uq_org_members_one_owner_per_user` de 000057, que sai junto com `idx_org_members_user_id`). Criar ou aceitar convite com org já existente retorna 409 `ALREADY_HAS_ORG`
- Fila de notificações com exclusão mútua: `ProcessQueue` reserva cada notificação com `FOR UPDATE SKIP LOCKED` em transação curta (`Repository.ReserveAndSend`); instâncias concorrentes não enviam o mesmo e-mail em paralelo. Envio é at-least-once: crash entre o envio e o COMMIT reenvia. `Repository.UpdateStatus` e `IncrementRetry` removidos
- Convites: `role=owner` rejeitado com 400 `INVALID_ROLE`; convites só para `admin`, `manager`, `employee`, `viewer`
- Rotas `/api/v1/organizations/me/*` de membros e convites passam a exigir permissão RBAC (BREAKING: viewer recebe 403 `FORBIDDEN`)
- Lease deixa de ter `owner_id` (BREAKING: campo removido do JSON de lease; migration 000059 solta o NOT NULL da coluna, que fica como legado opcional; INSERT deixa de gravá-la)
- `ListByLease` de readjustment filtra só por organização (`orgID`), sem `ownerID`
- Token de convite guardado como hash SHA-256 (migration 000058 converte convites pendentes sem invalidar os links). Down irreversível. Convites pendentes no dev antes da migration: 0
- Aceite `POST /api/v1/invites/accept`: 404 `INVITE_NOT_FOUND` (inexistente ou e-mail diferente do convite), 400 `INVITE_EXPIRED`, 409 `INVITE_ALREADY_USED`, 409 `INVITE_BRANCH_GONE` (filial removida), 409 `ALREADY_HAS_ORG`, 500 `ACCEPT_INVITE_FAILED`
- Migration 000061 (`organization_invites_without_owner`): apaga convites com `role='owner'` (pendentes e aceitos). Destrutiva; o down só restaura a constraint, não os dados
- Tickets de suporte sem organização: `organization_id` anulável (migration 000063; down falha se houver tickets sem org); `POST /api/v1/support/tickets` sem `orgReadMw`
- `APP_PUBLIC_URL` (default `http://localhost:3000`) usado como base do link de convite
- Claim `role` removido do JWT: `identity.SignWithOrg` não grava mais papel; `AuthResult.Role` e `OrgMembership.Role` removidos

### Deprecated
- API v1 endpoints are marked for deprecation. Use `/api/v2` paths instead.

### Removed
- Código morto do backend: `rbac.RoleMiddleware`, `importexport.PropertyRepository`, `ratelimit.LimiterByID`, helpers de `pkg/auth` e constantes/funções sem uso
- `rbac.Service.CheckPermission` e `getCurrentUser` do frontend (`lib/go/server-auth.ts`, apontava para `/api/v1/auth/me`, inexistente); `rbac.Service.CheckPermission` não tinha chamador
- Rota `POST /api/v1/notifications/process`: envio de notificações passa a ser feito só pelo worker
- Rotas sem consumidor: `GET /api/v1/indices/{type}/history`, `POST /api/v1/leases/{id}/adjust`, `GET /api/v1/expenses/summary`, `GET /api/v1/fiscal/annual-report`, `GET /api/v1/import/history/{id}`
- Rotas sem consumidor: `GET /api/v1/financial/commissions` (stub que devolvia lista vazia), `POST /api/v1/payments/{id}/charge`, `POST /api/v1/payments/{id}/payout`, `GET /api/v1/payments/summary`, `POST /api/v1/leases/{id}/payments/generate`
- Pacote `payment/provider` (integrações de cobrança sem chamador de produção) e `payment.UpdateChargeInfo`
- `organization.CreateMember` (INSERT direto de membro, sem convite) e mock/teste correspondentes

### Fixed
- `GET` de notificação por id e listagem por owner falhavam com `cannot scan NULL into *time.Time` para notificações não enviadas (`sent_at` NULL); ambas passam a usar `scanNotification`
- Docs do webhook de pagamento citavam `/payments/webhook`; rota real é `POST /api/v1/webhook/{provider}` (`backend/CLAUDE.md`, `backend/internal/payment/CLAUDE.md`, ADR `docs/decisions/payment/0002`)

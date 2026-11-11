# Proposal

## Why

Revisão do código encontrou três falhas de controle de acesso no backend:

- `POST /api/v1/organizations` checa "usuário já tem org" fora da transação (`organization/service.go:70-77`) e não há restrição no banco. Duas requisições concorrentes criam duas orgs com o mesmo owner.
- `POST /api/v1/notifications/process` executa `ProcessQueue`, que lê notificações pendentes de **todas** as orgs (`notification/repository.go` `ListPending` sem filtro). Qualquer usuário com `member:manage` dispara envio de emails de outras orgs. O worker já executa a mesma função a cada minuto (`cmd/api/main.go:279`), e o frontend não chama essa rota.
- `PermissionMiddleware` (`rbac/middleware.go:27-37`) e a checagem owner-only do audit leem o role apenas do JWT. Quem perde um role continua com acesso até o token expirar.

## What Changes

- Remover a rota `POST /api/v1/notifications/process` e o handler `processQueue`. O worker continua como único caminho de envio. **BREAKING** para qualquer cliente externo que chame a rota (nenhum consumidor interno encontrado).
- Garantir um owner por usuário: índice único parcial `organization_members(user_id) WHERE role = 'owner'` em nova migration, precedido de verificação de duplicatas existentes. `CreateWithOwner` mapeia violação de unicidade para 409 `ALREADY_HAS_ORG`, sem segunda org.
- Revalidar membership no banco nas rotas protegidas por `PermissionMiddleware` (`/api/v2/roles` POST/DELETE, `GET /api/v1/audit-logs` e demais rotas com `member:manage`). **Decisão pendente**: consulta no banco (recomendado) ou TTL curto do access token (ver `design.md`, Open Questions).
- Testes: handler de `POST /organizations` (201/409/400) e teste de integração com requisições concorrentes; rota removida retorna 404; membership revogado retorna 403.

Fora do escopo desta change: aceite de convite (`POST /organizations/invites/accept`). Não há tela no frontend hoje; comparar o email do convite e renovar o token ficam para a change que construir a tela.

## Capabilities

### New Capabilities

- `organization-membership`: um owner por usuário e criação de organização sem corrida.
- `notification-dispatch`: envio de notificações exclusivamente pelo worker interno, sem endpoint HTTP.
- `org-role-enforcement`: papel validado contra a membership em rotas sensíveis.

### Modified Capabilities

Nenhuma.

## Impact

- Backend: `internal/organization` (service, repository, migration), `internal/notification` (handler, rota), `internal/rbac` (middleware), `internal/audit/handler.go`, `cmd/api/main.go`.
- Banco: nova migration com índice parcial. Falha se já houver dois owners para o mesmo usuário; a verificação vem antes.
- API: `/api/v1/notifications/process` some (404).
- Frontend: nenhuma mudança esperada.

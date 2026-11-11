# Tasks

## 1. Remover envio de notificações via HTTP

- [x] 1.1 Remover a rota `POST /api/v1/notifications/process` e o handler `processQueue` em `backend/internal/notification/handler.go`
- [x] 1.2 Teste: `POST /api/v1/notifications/process` responde 405 (path casa com `/notifications/{id}`, só GET; sem rota de envio)
- [x] 1.3 Atualizar `backend/internal/notification/CLAUDE.md` e qualquer anotação swagger que cite a rota (verificado: nenhuma referência)

## 2. Um owner por usuário

- [x] 2.1 Rodar a query de pré-requisito (owners duplicados) no banco de dev e de teste; registrar o resultado (dev e teste: 0 duplicatas)
- [x] 2.2 Nova migration: índice único parcial `organization_members(user_id) WHERE role = 'owner'` (`000057_unique_owner_per_user`)
- [x] 2.3 `CreateWithOwner` em `backend/internal/organization/repository.go`: mapear erro `23505` para `ErrAlreadyHasOrganization`
- [x] 2.4 Teste de handler de `POST /api/v1/organizations`: 201, 409 `ALREADY_HAS_ORG`, 400
- [x] 2.5 Teste de integração: duas requisições concorrentes do mesmo usuário geram exatamente um 201 e um 409 (sem o índice o teste falha: owners=2)

## 3. Revalidação de papel contra a membership

- [x] 3.1 `PermissionMiddleware` em `backend/internal/rbac/middleware.go` recebe `MembershipRoles` por injeção (adapter `membershipRoles` em `cmd/api/main.go`) e consulta `(user_id, organization_id)` em `organization_members`
- [x] 3.2 Usar o role do banco; sem membership → 403 `FORBIDDEN`
- [x] 3.3 Checagem owner-only de `GET /api/v1/audit-logs` (`backend/internal/audit/handler.go`) passa a usar o role do banco
- [x] 3.4 Testes: owner rebaixado recebe 403; membro removido recebe 403; membership vigente segue com 200

## 4. Verificação e documentação

- [x] 4.1 `make test-backend` e `make test-backend-integration` passam
- [x] 4.2 `swag init` não necessário (nenhuma anotação de rota alterada em audit/rbac); `graphify update .` executado
- [x] 4.3 Entrada em `backend/CHANGELOG.md` (Removed: rota de process; Changed: owner único e revalidação de papel)

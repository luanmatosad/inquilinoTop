# Fase 2: Organization Domain & Member Invitation

## Status: ⏳ Pendente

### Tasks

#### Organization Domain (Tasks 4.1 a 4.5 + Tasks 11.1)
- [ ] 4.1 Criar `backend/internal/organization/model.go`
  - Structs: `Organization`, `Branch`, `OrganizationMember`, `OrganizationInvite`
  - Input types para CRUD
  - Interface `Repository` com todos os métodos
- [ ] 4.2 Criar `backend/internal/organization/repository.go`
  - CRUD para Organizations, Branches, Members, Invites
  - Queries filtradas por `organization_id`
- [ ] 4.3 Criar `backend/internal/organization/service.go`
  - `CreateOrganization`, `GetOrganization`, `UpdateOrganization`
  - `CreateBranch`, `ListBranches`, `UpdateBranch`
  - `GetMember`, `ListMembers`, `UpdateMemberRole`, `RemoveMember`
  - `GetMembershipByUser`
- [ ] 4.4 Criar `backend/internal/organization/handler.go`
  - Rotas: `GET/PUT /api/v2/me/organization`
  - Rotas: `POST/GET/DELETE /api/v2/organizations/branches`
  - Rotas: `GET/DELETE /api/v2/organizations/members`
  - Rotas: `PUT /api/v2/organizations/members/{id}/role`
- [ ] 4.5 Registrar em `main.go`

#### Invitation Domain (Tasks 5.1 a 5.3)
- [ ] 5.1 Métodos de convite no repository
  - `CreateInvite` (gera token único)
  - `GetInviteByToken`
  - `AcceptInvite` (seta `accepted_at`)
  - `CancelInvite`
  - `ListInvites` (pendentes por org)
- [ ] 5.2 Métodos de convite no service
  - `CreateInvite` (valida email único, verifica perm)
  - `AcceptInvite` (verifica token, email, expiry, cria membership)
  - `ListInvites`
  - `CancelInvite`
- [ ] 5.3 Rotas de convite
  - `POST /api/v2/organizations/invites`
  - `GET /api/v2/organizations/invites`
  - `DELETE /api/v2/organizations/invites/{id}`
  - `POST /api/v2/organizations/invites/{token}/accept`

#### Auth JWT Integration (Task 3.4)
- [ ] 3.4 Atualizar `identity/service.go` — `issueTokens` busca membership e chama `SignWithOrg`

#### Constraints (Tasks 11.1)
- [ ] 11.1 Adicionar FK constraint de `users.organization_id` → `organizations.id`

### Dependências
- ⛔ Bloco inicial — nenhuma dependência externa
- ✅ Requer que Fase 1 (database + auth) esteja completa

### Ordem de Implementação
1. `model.go` (structs + interfaces)
2. `repository.go` (implementação)
3. `service.go` (lógica de negócio)
4. `handler.go` (rotas)
5. Registro em `main.go`
6. Atualização de `identity/service.go`

### Arquivos a Criar
- `backend/internal/organization/model.go`
- `backend/internal/organization/repository.go`
- `backend/internal/organization/service.go`
- `backend/internal/organization/handler.go`

### Arquivos a Modificar
- `backend/cmd/api/main.go`
- `backend/internal/identity/service.go`
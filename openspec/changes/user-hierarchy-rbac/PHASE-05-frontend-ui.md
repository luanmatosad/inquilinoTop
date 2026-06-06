# Fase 5: Frontend Organization Context & Team Management UI

## Status: ⏳ Pendente

### Tasks

#### Frontend Organization Context (Tasks 13.1 a 13.3)
- [ ] 13.1 `frontend/src/lib/go/client.ts`
  - Armazenar `organization_id` em cookie ou state
  - Incluir `organization_id` no JWT payload (já vem do backend)
- [ ] 13.2 `frontend/src/middleware.ts`
  - Tratar organização no fluxo de autenticação
  - Redirecionar para onboarding se usuário sem organização
- [ ] 13.3 Criar hook/context `useOrganization`
  - Expor `organization`, `role`, `branch`, `permissions`
  - Método `switchOrganization` para futuro multi-org

#### Team Management UI (Tasks 12.1 a 12.5)
- [ ] 12.1 Criar `frontend/src/app/settings/team/page.tsx`
  - Lista de membros da organização
  - Avatar, nome, email, role, filial
  - Badge de role (owner, admin, manager, etc.)
- [ ] 12.2 Dialog/sheet de convite
  - Form: email, role (dropdown), branch (opcional)
  - Validação de email
  - Feedback de convite enviado
- [ ] 12.3 Ação de remover membro
  - Confirmação antes de remover
  - Não permite remover owner
  - Botão só visível para admin/owner
- [ ] 12.4 Dropdown de alteração de role
  - Só para admin/owner
  - Não permite alterar role de owner
- [ ] 12.5 Adicionar link no navigation
  - Adicionar `/settings/team` no sidebar de settings
  - Ativo para admin/owner

### Dependências
- ⛔ Requer que **Fase 2** (Organization API) esteja completa
- ⛔ Requer que **Fase 3** (RBAC) esteja completa (UI filtra por permissões)

### Arquivos a Criar
- `frontend/src/contexts/OrganizationContext.tsx` (ou hook)
- `frontend/src/app/settings/team/page.tsx`
- `frontend/src/components/settings/team/MemberList.tsx`
- `frontend/src/components/settings/team/InviteDialog.tsx`
- `frontend/src/components/settings/team/RoleDropdown.tsx`

### Arquivos a Modificar
- `frontend/src/lib/go/client.ts`
- `frontend/src/middleware.ts`
- `frontend/src/app/settings/page.tsx` (adicionar link para team)
- `frontend/src/components/layout/Sidebar.tsx` (se existir)
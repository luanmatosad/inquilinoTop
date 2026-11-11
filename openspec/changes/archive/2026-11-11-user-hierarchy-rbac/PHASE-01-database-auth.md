# Fase 1: Database & Auth Foundations

## Status: ✅ Implementada

### Tasks

1. **Database Migration** — Tasks 1.1 a 1.8 ✅
   - Migration `000031_create_organizations.sql`
   - Tabelas: `organizations`, `branches`, `organization_members`, `organization_invites`
   - Colunas `organization_id` em: `users`, `properties`, `tenants`, `leases`, `payments`, `expenses`
   - Seed automático para usuários existentes

2. **Auth/JWT Update** — Tasks 3.1 a 3.3 ✅
   - JWT Claims com `organization_id`, `role`, `branch_id`
   - Helpers: `OrganizationIDFromCtx`, `RoleFromCtx`, `BranchIDFromCtx`
   - Middleware popula contexto com claims do token

### Pendente (requer Organization domain)

- [ ] 3.4 `issueTokens` precisa buscar membership do usuário e incluir `organization_id` no token

### Dependências
- Nenhuma (bloco inicial)

### Arquivos Implementados
- `backend/migrations/000031_create_organizations.up.sql`
- `backend/migrations/000031_create_organizations.down.sql`
- `backend/pkg/auth/jwt.go`
- `backend/pkg/auth/middleware.go`
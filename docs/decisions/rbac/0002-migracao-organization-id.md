# 0002 - Migração de domínios para organization_id

**Status**: Accepted

## Context

O RBAC original ([0001](./0001-hierarquia-roles-property-scoped.md)) não suportava equipes — um usuário só atuava dentro do próprio `owner_id`, sem convidar colaboradores, e papéis não eram de fato aplicados como controle de acesso (sem middleware de autorização nas rotas de domínio). Era preciso suportar múltiplos usuários colaborando na mesma conta, com papéis distintos e permissões por recurso.

## Decision

Introduzido o domínio `organization` (organizations, branches, members, invites) e todos os domínios existentes (`property`, `tenant`, `lease`, `payment`, `expense`, `audit`, `fiscal`, `support`) migraram a chave de particionamento de `owner_id` para `organization_id`. Hierarquia de papéis expandida pra 5 níveis (`owner > admin > manager > employee > viewer`), com matriz de permissões por recurso:ação (`property:read`, `payment:write`, etc.) checada via `PermissionMiddleware`, aplicado em todas as rotas de domínio (commit `5ff91c4`).

Claims do JWT passam a incluir `organization_id`, `role` e `branch_id` — extraídos via `auth.OrganizationIDFromCtx`/`RoleFromCtx`/`BranchIDFromCtx`.

## Consequences

- **BREAKING** de schema: toda tabela com `owner_id` precisou de migration pra `organization_id` (migrations 000031-000033) — dados existentes precisaram de backfill (criar uma organization implícita por owner antigo)
- RBAC deixa de ser só bookkeeping — `PermissionMiddleware` bloqueia de fato: 401 sem organização no contexto, 403 sem a permission exigida
- `RoleOwner` tem bypass hierárquico em `RoleMiddleware` — sempre passa, independente da lista de roles exigida
- Toda query de domínio precisa filtrar por `organization_id` agora, não mais `owner_id` — regra equivalente à invariante de `owner_id` em `domain-model.md`, só que o nome do campo mudou
- Fluxo de convite (`member:invite`) precisa existir pra equipe crescer — acoplado ao domínio `organization`

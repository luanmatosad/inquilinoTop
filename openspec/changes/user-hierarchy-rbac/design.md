## Context

O backend atual usa `owner_id` como filtro central em todas as queries — cada tabela (`properties`, `tenants`, `leases`, `payments`) tem `owner_id` como FK para `users`. Não existe organização intermediária, hierarquia de usuários ou RBAC aplicado nas rotas. O middleware RBAC existe em `internal/rbac/middleware.go` mas não é usado em nenhuma rota de domínio. A tabela `user_roles` (migration 000020) suporta roles globais ou escopados a `property_id`, mas não há conceito de "imobiliária" nem de equipes.

Para atender pequenas e grandes imobiliárias, precisamos de uma entidade organizacional que agrupe usuários, imóveis e dados de forma hierárquica.

## Goals / Non-Goals

**Goals:**
- Criar estrutura de organização hierárquica (Organization → Branches → Members)
- Roles com herança (owner > admin > manager > employee > viewer)
- Integração do middleware RBAC nas rotas de domínio
- Propriedades pertencem à organização (não mais diretamente ao user)
- API de convite e gerenciamento de membros
- JWT inclui `organization_id` e `branch_id` para contexto de escopo

**Non-Goals:**
- Migrar dados existentes de `owner_id` para `organization_id` nesta change (data migration futura)
- Implementar SSO, SAML, ou federation de identidade
- Billing/subscription por organização
- Multi-organização simultânea para um mesmo usuário (single-org por vez)

## Decisions

### 1. Organization como raiz do tenancy

**Decisão:** Criar tabela `organizations` como entidade raiz. Todo recurso (`properties`, `tenants`, `leases`, `payments`, `users`) aponta para `organization_id`.

**Alternativa considerada:** Usar `users.owner_id` como raiz (status quo). Descartado porque não escala — não há conceito de equipe, convite, ou hierarquia.

**Alternativa considerada:** Usar PostgreSQL schema por tenant. Descartado pela complexidade de migrations e pool de conexões.

**Resultado:** `organization_id` em todas as tabelas de domínio. Queries filtram por `organization_id` ao invés de `owner_id`.

### 2. Roles com hierarquia via herança de permissões

**Decisão:** Roles em ordem de privilégio: `owner > admin > manager > employee > viewer`. Cada role herda permissões dos níveis inferiores. Permissões definidas por capability/action (`property:read`, `property:write`, `tenant:read`, `payment:write`, etc.).

**Alternativa considerada:** Roles planos (sem herança, cada role lista todas as permissões). Descartado — aumenta complexidade na administração e não espelha a realidade organizacional.

**Implementação:** Matriz de permissões em `rbac/service.go`. Hierarquia definida como `map[RoleType][]RoleType` onde a key herda todas as permissions dos values.

### 3. Branches como escopo opcional

**Decisão:** `branches` é uma tabela filha de `organization`. Roles globais (`branch_id = NULL`) dão acesso a toda organização; roles escopados (`branch_id = SET`) limitam acesso à filial.

**Alternativa considerada:** Sem branches, apenas roles globais. Descartado para grandes imobiliárias que precisam isolar equipes por região.

**Resultado:** `organization_members` tem `branch_id` opcional. Filtro de acesso usa `branch_id` quando presente.

### 4. Migração de `owner_id` → `organization_id`

**Decisão:** Criar migration que adiciona `organization_id` como nullable, cria organização automática para cada owner existente, e faz backfill. `owner_id` é removido em mudança futura.

**Justificativa:** Permite coexistência durante transição sem quebrar queries existentes. Data migration é breaking change e será feita separadamente.

### 5. Convite por email com link mágico

**Decisão:** Fluxo: admin cria convite → sistema gera token → email enviado → usuário clica → registra/login → entra na organização com role designado.

**Alternativa considerada:** Criar usuário diretamente (precisa definir senha). Descartado porque envolve envio de senha provisória.

**Resultado:** Tabela `organization_invites` com token, email, role, branch_id, expiry.

## Data Model

```
organizations
  id, name, plan, created_at, updated_at

branches
  id, organization_id, name, region?, is_active, created_at, updated_at

organization_members
  id, organization_id, user_id, role (owner|admin|manager|employee|viewer),
  branch_id (nullable), created_at, updated_at

organization_invites
  id, organization_id, email, role, branch_id (nullable),
  token (unique), invited_by, expires_at, accepted_at (nullable), created_at
```

## API Changes

| Método | Rota | Mudança |
|--------|------|---------|
| POST | /api/v2/organizations | Criar organização (Owner cria ao se registrar) |
| GET | /api/v2/me/organization | Retorna org atual + branches + membros |
| POST | /api/v2/organizations/invites | Criar convite |
| GET | /api/v2/organizations/invites | Listar convites pendentes |
| DELETE | /api/v2/organizations/invites/{id} | Cancelar convite |
| POST | /api/v2/organizations/invites/{token}/accept | Aceitar convite (autenticado) |
| DELETE | /api/v2/organizations/members/{id} | Remover membro |
| PUT | /api/v2/organizations/members/{id}/role | Alterar role |

## Risks / Trade-offs

- **[Risk]** Breaking change em todas as queries de domínio (ownerID → organizationID) → **Mitigation:** Migration adiciona nullable, backfill automático, feature flag para switch gradual.
- **[Risk]** Usuários existentes sem organização não conseguem acessar dados → **Mitigation:** Seed de organização automática para users existentes.
- **[Risk]** Complexidade de escopo no middleware (org + branch) → **Mitigation:** Helpers em `auth.OwnerIDFromCtx` ganham overload com `OrganizationIDFromCtx`.
- **[Risk]** Convites por email requerem SMTP configurado → **Mitigation:** Avisar se SMTP não configurado, invitar via link direto (sem email) em dev.

## Migration Plan

1. Nova migration `000026_create_organizations.sql` — cria tabelas sem remover `owner_id`
2. Seed: para cada user existente, criar organization + membership owner
3. Atualizar `auth/jwt.go` para incluir `organization_id` no token
4. Criar `organization` domain (model, repo, service, handler)
5. Criar `member invitation` domain
6. Atualizar `rbac/service.go` com matriz de permissões hierárquicas
7. Atualizar todos os domain repositories para filtrar por `organization_id` (ao invés de `ownerID`)
8. UI de team management em `/settings/team`
9. Feature flag: fallback para `ownerID` se `organization_id` não presente

**Rollback:** Reverse migration remove colunas, mantém dados. Queries voltam a funcionar com owner_id.

## Open Questions

1. O plano FREE deve limitar a número de membros ou branches? Definir limites por plan.
2. Quem pode convidar? Somente owner e admin, ou manager também?
3. Branch deve ter hierarchy própria (sub-branch)? MVP: apenas flat.
4. Como tratar dados existentes com owner_id sem organização? (Decisão: seed automático + warning no admin panel)
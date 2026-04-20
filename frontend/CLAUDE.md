# Frontend — Next.js 16 App Router

**Todos os domínios ainda usam Supabase** — nenhum foi migrado para o Go backend ainda. Antes de implementar qualquer feature, verificar se o domínio existe no Go e migrar.

## Estrutura

```
src/app/                     # Pages + Server Actions (App Router)
src/app/<módulo>/actions.ts  # Server Actions ("use server")
src/components/<módulo>/     # Feature components (forms, lists, dialogs)
src/components/ui/           # Shadcn/UI — NÃO modificar
src/components/dashboard/    # StatsCards, FinancialSummary, RecentActivity
src/data/dashboard/dal.ts    # Data Access Layer — queries Supabase para dashboard
src/lib/schemas.ts           # Schemas Zod (propertySchema, unitSchema)
src/lib/supabase/            # client.ts | server.ts | middleware.ts
src/types/index.ts           # Interfaces TypeScript espelhando os modelos Go
src/middleware.ts             # Auth: redireciona não-autenticados para /login
```

## Páginas

| Rota | Página |
|---|---|
| `/` | Dashboard (métricas + StatsCards + FinancialSummary + RecentActivity) |
| `/login` | Login Supabase |
| `/properties` | Lista de imóveis |
| `/properties/new` | Criar imóvel |
| `/properties/[id]` | Detalhe com UnitList |
| `/properties/[id]/edit` | Editar imóvel |
| `/tenants` | Lista de inquilinos |
| `/units/[id]` | Detalhe de unidade |

## Auth

Middleware protege tudo exceto `/`, `/login`, `/auth/callback`. Autenticação via Supabase Auth. Usuário logado em `/login` → redireciona para `/`.

## Server Actions Pattern

Todas as actions em `src/app/<módulo>/actions.ts`:
1. `"use server"` no topo
2. Validar com Zod (`schema.safeParse`)
3. Chamar Supabase (legado) ou Go API (migrado)
4. `revalidatePath("/rota")`
5. Retornar `ActionResponse<T>` = `{success?, data?, error?, details?}`

## Dashboard DAL (`src/data/dashboard/dal.ts`)

Queries paralelas via `Promise.all` ao Supabase: contagem de properties/tenants, unidades com status de ocupação, pagamentos do mês corrente, contratos vencendo em 30 dias. Computado no server component.

## Status de Migração por Domínio

| Domínio | Go Backend | Frontend |
|---|---|---|
| property + unit | ✓ implementado | ainda Supabase |
| tenant | ✓ implementado | ainda Supabase |
| lease | ✓ implementado | ainda Supabase |
| payment | ✓ implementado | ainda Supabase |
| expense | ✓ implementado | ainda Supabase |
| identity/auth | ✓ implementado | Supabase Auth (migração requer mudança maior) |

## Gotchas

- `src/types/index.ts` pode divergir do modelo Go (ex: `Lease.payment_day` existe no tipo TS mas não no modelo Go).
- Dashboard usa Supabase diretamente — não há DAL para Go ainda.
- Schemas Zod em `schemas.ts` só cobrem property e unit — outros domínios não têm schemas frontend.

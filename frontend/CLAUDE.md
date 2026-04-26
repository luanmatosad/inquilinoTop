# Frontend — Next.js 16 App Router

Auth já migrado para Go (`src/lib/go/client.ts`). Demais domínios ainda usam Supabase.

## Estrutura

```
src/app/                     # Pages + Server Actions (App Router)
src/app/<módulo>/actions.ts  # Server Actions ("use server")
src/components/<módulo>/     # Feature components (forms, lists, dialogs)
src/components/ui/           # Shadcn/UI — NÃO modificar
src/components/dashboard/    # StatsCards, FinancialSummary, RecentActivity
src/data/dashboard/dal.ts    # Data Access Layer — queries Supabase para dashboard
src/data/financeiro/dal.ts   # DAL financeiro (stub/placeholder)
src/lib/go/client.ts         # Cliente HTTP para Go API (goFetch, login, logout, refresh)
src/lib/go/middleware.ts     # Middleware Go auth
src/lib/schemas.ts           # Schemas Zod (propertySchema, unitSchema)
src/lib/supabase/            # client.ts | server.ts | middleware.ts
src/middleware.ts             # Auth: redireciona não-autenticados para /login
```

## Páginas

| Rota | Página |
|---|---|
| `/` | Dashboard |
| `/login` | Login via Go API |
| `/properties`, `/properties/[id]`, `/properties/[id]/edit` | Imóveis (Supabase) |
| `/tenants` | Inquilinos (Supabase) |
| `/units/[id]` | Detalhe de unidade (Supabase) |
| `/financeiro/dashboard` | Dashboard financeiro (stub) |
| `/financeiro/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao` | Financeiro (stub) |
| `/support`, `/support/tickets`, `/support/tickets/[id]`, `/support/new-ticket`, `/support/contacts` | Suporte |

## Auth — MIGRADO para Go

`src/lib/go/client.ts`: `goFetch<T>` (wrapper com Bearer token + refresh automático), `login`, `register`, `logout`, `getCurrentUser`.

Tokens armazenados em cookies httpOnly (`access_token`, `refresh_token`). `goFetch` faz refresh automático em 401.

`src/app/auth/actions.ts` usa `goLogin`/`goRegister`/`goLogout` — não Supabase.

## Server Actions Pattern

Todas as actions em `src/app/<módulo>/actions.ts`:
1. `"use server"` no topo
2. Validar com Zod (`schema.safeParse`)
3. Chamar Go API (`goFetch`) ou Supabase (legado)
4. `revalidatePath("/rota")`

## Status de Migração por Domínio

| Domínio | Go Backend | Frontend |
|---|---|---|
| identity/auth | ✓ | **MIGRADO** — usa `src/lib/go/client.ts` |
| property + unit | ✓ | ainda Supabase |
| tenant | ✓ | ainda Supabase |
| lease | ✓ | ainda Supabase |
| payment | ✓ | ainda Supabase |
| expense | ✓ | ainda Supabase |
| support | ✓ | ainda Supabase (actions em `/support/actions.ts`) |
| financeiro | ✓ (fiscal) | stub — sem DAL real ainda |

## Gotchas

- `goFetch` retorna `(data as { data: T }).data` — unwrap do envelope `{"data": ...}`.
- `goFetch` com `skipAuth: true` não adiciona Authorization header — usado em login/register/refresh.
- Dashboard e financeiro usam Supabase diretamente — não há DAL para Go ainda.
- Schemas Zod em `schemas.ts` só cobrem property e unit.

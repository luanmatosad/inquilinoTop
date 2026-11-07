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
| `/properties`, `/properties/[id]` | Imóveis (Go API): lista em tabela com indicadores; detalhe em abas (`?aba=unidades\|informacoes`). `/properties/new` e `/properties/[id]/edit` só redirecionam |
| `/tenants` | Inquilinos (Supabase) |
| `/units/[id]` | Detalhe de unidade (Supabase) |
| `/financeiro/dashboard` | Dashboard financeiro (stub) |
| `/financeiro/receber`, `/pagar`, `/repasses`, `/comissoes`, `/conciliacao` | Financeiro (stub) |
| `/reports`, `/integrations` | Placeholders (`ComingSoon`), com item de menu no canvas e sem tela ainda |
| `/support`, `/support/tickets`, `/support/tickets/[id]`, `/support/new-ticket`, `/support/contacts` | Suporte |

## Shell e navegação

O canvas "ImoviFlow — Telas" é a fonte da verdade da navegação (change `redesign-foundation`).

- `src/lib/nav.ts`: única definição. 3 grupos (Gestão: Hoje, Imóveis, Inquilinos, Contratos · Financeiro: Recebimentos, Despesas, Relatórios · Administrativo: Integrações, Configurações). Itens com `mobileTab` viram abas da barra inferior; os demais caem em "Mais" (`moreItems`).
- Sem item de menu: Laudos, Importar, Documentos e Fechamento (as rotas `/inspections` e `/import` continuam acessíveis por URL).
- `AppShell` → `AppSidebar` (servidor: carrega organização e perfil) → `Sidebar` (desktop) + `MobileTabBar` (celular, `md:hidden`). Não há modo visitante: sem sessão, o middleware redireciona para `/login`.
- Tokens em `src/app/globals.css` espelham o `tokens.json` do canvas (claro e escuro). Fontes: Urbanist e Space Mono, self-hosted via `@fontsource`.

## Imóveis (redesign)

- **Painéis por URL:** `/properties?novo=1` abre o cadastro de imóvel; no detalhe, `?unidade=nova` ou `?unidade=<id>` abre o de unidade (`PropertyFormSheet`, `UnitFormSheet`). Fechar tira só o parâmetro da URL.
- **Ocupação** (alugada/vaga, inquilino, "desde"): função pura `src/lib/property-occupancy.ts`, que junta imóveis + contratos `ACTIVE` + inquilinos no servidor Next. Contratos fora do ar degradam para "—" em vez de derrubar a tela. `/leases` e `/tenants` não paginam, então se a base crescer essa regra deve migrar para o backend.
- **Tipos:** `RESIDENTIAL`, `COMMERCIAL` e `SINGLE` (rótulo "Casa"). "Terreno" do canvas mobile não existe no domínio.
- **Endereço:** `number` e `complement` são colunas próprias; `formatPropertyAddress` compõe o texto de exibição.
- Fora desta etapa: preenchimento do endereço pelo CEP, abas Despesas e Recebimento do detalhe, "Aluguel de referência" da unidade (entra com Contratos).

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

## Decisões

- [cross-cutting-0002](../docs/decisions/_cross-cutting/0002-shadcn-ui-unica-biblioteca.md): shadcn/ui é a única biblioteca de UI; `@heroui/*` bloqueado por lint.

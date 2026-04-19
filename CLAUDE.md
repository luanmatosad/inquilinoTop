# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Environment Setup

Create `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Run SQL scripts in `supabase/` in order: `schema.sql` → `schema_step2_tenants_finance.sql` → `schema_step3_expenses.sql` → (optional) `fix_expenses_rls.sql`.

## Architecture

**Next.js 15 App Router** with Supabase (PostgreSQL + Auth) as the backend. No API routes — all mutations are Next.js Server Actions.

### Data Flow

- **Server Actions** (`src/app/<module>/actions.ts`): All mutations use `"use server"`, validate with Zod schemas from `src/lib/schemas.ts`, call Supabase, then `revalidatePath()`.
- **DAL** (`src/data/`): Server-side read queries (e.g., `getDashboardMetrics()`). Currently only dashboard has a DAL file; other pages fetch directly in page components.
- **Supabase clients**: `src/lib/supabase/server.ts` for Server Components/Actions, `src/lib/supabase/client.ts` for Client Components, `src/lib/supabase/middleware.ts` for session refresh.

### Auth

Middleware (`src/middleware.ts`) protects all routes except `/`, `/login`, `/auth/callback`. Authenticated users hitting `/login` are redirected to `/`.

### Domain Model

Core entities and their relationships (all scoped to `owner_id` via Supabase RLS):
- **Property** (`RESIDENTIAL` | `SINGLE`) → has many **Unit**s. `SINGLE` properties get one unit auto-created.
- **Tenant** → linked via **Lease** to a **Unit** (status: `ACTIVE` | `ENDED` | `CANCELED`)
- **Payment** → belongs to a **Lease** (status: `PENDING` | `PAID` | `LATE`; type: `RENT` | `DEPOSIT` | `EXPENSE` | `OTHER`)
- **Expense** → belongs to a **Unit** (categories: `ELECTRICITY` | `WATER` | `CONDO` | `TAX` | `MAINTENANCE` | `OTHER`)

Deletions are soft-deletes via `is_active: false`.

### UI Components

Shadcn/UI components live in `src/components/ui/`. Feature components (forms, lists, dialogs) are in `src/components/<module>/`. Forms use `react-hook-form` + Zod resolvers and call Server Actions directly.

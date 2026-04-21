# InquilinoTop

Monorepo: gestão de imóveis para locação. Backend Go (`backend/`) substituindo progressivamente Supabase. Frontend Next.js 15 App Router (`frontend/`). Novas features SEMPRE no Go primeiro.

## Stack

| Camada | Tech |
|---|---|
| Backend | Go 1.25, chi v5, pgx v5, golang-migrate, RS256 JWT, swaggo |
| Frontend | Next.js 16, React 19, Supabase SSR, react-hook-form, Zod, Shadcn/UI, Tailwind v4 |
| DB | PostgreSQL (migrations em `backend/migrations/`) |
| Infra | Docker Compose |

## Comandos

```bash
make up / down / logs         # Docker full stack
make test-backend              # testes unitários (sem DB)
make test-backend-integration  # todos os testes (requer Docker)
make build-backend             # compila binário
make setup                     # cria .env
make keys                      # gera par RSA para JWT
npm run dev                    # frontend dev em :3000
```

## Regras Detalhadas (carregadas automaticamente)

@.claude/rules/domain-model.md
@.claude/rules/backend-architecture.md
@.claude/rules/backend-api-design.md
@.claude/rules/backend-testing.md
@.claude/rules/frontend.md

## Módulos

| Módulo | Docs | Status Frontend |
|---|---|---|
| Backend geral | [backend/CLAUDE.md](backend/CLAUDE.md) | — |
| identity | [backend/internal/identity/CLAUDE.md](backend/internal/identity/CLAUDE.md) | Supabase Auth (não migrado) |
| property + unit | [backend/internal/property/CLAUDE.md](backend/internal/property/CLAUDE.md) | Supabase (TODO migrar) |
| tenant | [backend/internal/tenant/CLAUDE.md](backend/internal/tenant/CLAUDE.md) | Supabase (TODO migrar) |
| lease | [backend/internal/lease/CLAUDE.md](backend/internal/lease/CLAUDE.md) | Supabase (TODO migrar) |
| payment | [backend/internal/payment/CLAUDE.md](backend/internal/payment/CLAUDE.md) | Supabase (TODO migrar) |
| expense | [backend/internal/expense/CLAUDE.md](backend/internal/expense/CLAUDE.md) | Supabase (TODO migrar) |
| fiscal | [backend/internal/fiscal/CLAUDE.md](backend/internal/fiscal/CLAUDE.md) | — |
| pkg/ | [backend/pkg/CLAUDE.md](backend/pkg/CLAUDE.md) | — |
| Frontend | [frontend/CLAUDE.md](frontend/CLAUDE.md) | Next.js 15 App Router |

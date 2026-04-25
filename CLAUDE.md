# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# InquilinoTop

Monorepo: gestão de imóveis para locação. Backend Go (`backend/`) substituindo progressivamente Supabase. Frontend Next.js 16 App Router (`frontend/`). Novas features SEMPRE no Go primeiro.

Dev stack roda em Docker Compose: backend em `:8080` (healthcheck `/health`, Swagger em `/swagger/`), frontend em `:3000`, Postgres dev em `:5432` e Postgres de testes em `:5433`.

## Stack

| Camada | Tech |
|---|---|
| Backend | Go 1.25, chi v5, pgx v5, golang-migrate, RS256 JWT, swaggo |
| Frontend | Next.js 16, React 19, Supabase SSR, react-hook-form, Zod, Shadcn/UI, Tailwind v4 |
| DB | PostgreSQL (migrations em `backend/migrations/`) |
| Infra | Docker Compose |

## Comandos

```bash
make help                      # lista todos os alvos do Makefile
make setup                     # cria .env a partir de .env.example
make keys                      # gera par RSA (backend/keys/) para JWT RS256
make up / up-build / down      # Docker full stack (up-build reconstrói imagens)
make logs / logs-backend       # logs agregados ou só do backend Go
make test-backend              # testes unitários (sem DB)
make test-backend-integration  # todos os testes (sobe DB de testes em :5433)
make build-backend             # compila binário em backend/tmp/main
make db-shell / db-shell-test  # psql no banco dev ou de testes
make frontend-lint             # ESLint no container do frontend
```

Todos os alvos rodam dentro dos containers via `docker compose exec` — não é preciso ter Go/Node localmente. O frontend tem `npm run dev` para rodar fora do Docker, mas o fluxo padrão do repo é `make up`.

**Rodar um único teste Go** (ajustar caminho e regex conforme o alvo):

```bash
docker compose exec backend go test ./internal/property/... -run TestService_CreateProperty_SoftDelete -v
docker compose exec backend go test ./internal/lease/... -run '^TestService_' -v
```

Integração exige `-p 1` (um pacote por vez) para não paralelizar acesso ao DB — veja `test-backend-integration` no Makefile.

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
| Frontend | [frontend/CLAUDE.md](frontend/CLAUDE.md) | Next.js 16 App Router |

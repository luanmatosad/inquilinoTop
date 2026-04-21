# AGENTS.md — InquilinoTop

Quick reference for OpenCode sessions. More detail in `CLAUDE.md`.

## Dev Commands (exact)

```bash
make up        # Docker full stack (postgres + backend + frontend)
make test-backend              # unit tests only (no DB required)
make test-backend-integration # requires Docker running
make build-backend             # compiles to ./backend/tmp/main
npm run dev                    # frontend at :3000 (runs in container via make up)
```

## Order Matters

`make up` must run first — backend depends on postgres with health check.

## Test Patterns (exact match)

`make test-backend` only runs tests matching: `TestService|TestHandler|TestSign|TestVerify|TestMiddleware|TestOK|TestErr`. This is intentional — unit tests only, no DB.

## Backend Structure

```
backend/cmd/api/main.go       # entry point + composition
backend/internal/<domain>/   # model.go | repository.go | service.go | handler.go
backend/pkg/auth/             # JWT RS256, keys in backend/keys/
backend/pkg/db/               # pgx pool, migrations run at startup
backend/migrations/           # golang-migrate, auto-run on startup
```

Every domain follows the same 4-file pattern. Handler NEVER calls repository directly.

## Frontend is Split

- All domain data access is still Supabase (not migrated to Go yet)
- Dashboard queries Supabase directly (`src/data/dashboard/dal.ts`)
- Only `identity/auth` uses Go backend rest; frontend auth still Supabase
- BEFORE implementing any feature: check if Go backend exists first

## Keys Setup

```bash
make keys  # generates backend/keys/private.pem + public.pem
```

Required for JWT. Without these, backend returns 500 on auth routes.

## DB Access

```bash
make db-shell        # dev DB (port 5432)
make db-shell-test   # test DB (port 5433)
```

Postgres test runs on 5433, mapped from postgres_test container.

## References

- Full backend docs: `backend/CLAUDE.md`
- Full frontend docs: `frontend/CLAUDE.md`
- Architecture rules: `.claude/rules/backend-architecture.md`
- Domain rules: `.claude/rules/domain-model.md`
- Project documentation `docs`
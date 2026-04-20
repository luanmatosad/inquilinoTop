# Backend Go — InquilinoTop

Go REST API. Módulo: `github.com/inquilinotop/api`. Binário em `cmd/api/main.go`.

## Estrutura

```
cmd/api/main.go          # Composição de dependências, roteamento, servidor HTTP
internal/<domínio>/      # model.go | repository.go | service.go | handler.go
pkg/auth/                # JWT RS256 + middleware + OwnerIDFromCtx
pkg/apierr/              # ErrNotFound (sentinel compartilhado)
pkg/db/                  # db.New (pgx pool) + db.RunMigrations
pkg/httputil/            # OK / Created / Err — envelope {data, error}
migrations/              # golang-migrate, numeradas sequencialmente
docs/                    # gerado por swag init — não editar manualmente
```

## Env Vars

| Var | Descrição |
|---|---|
| `DATABASE_URL` | URL PostgreSQL (obrigatório) |
| `JWT_PRIVATE_KEY_PATH` | Caminho para chave RSA privada (obrigatório) |
| `MIGRATIONS_PATH` | Diretório de migrations (default: `./migrations`) |
| `PORT` | Porta HTTP (default: `8080`) |
| `TEST_DATABASE_URL` | DB para testes de integração (default: localhost:5433) |

## Rotas Públicas

```
GET  /health                    # ping no banco
GET  /swagger/*                 # Swagger UI
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

## Padrão de Domínio (todos os módulos seguem)

1. `model.go`: struct + input types + interface `Repository`
2. `repository.go`: `pgRepository` implementa `Repository`, queries pgx
3. `service.go`: regras de negócio, recebe `Repository` por injeção
4. `handler.go`: decode → service → httputil; registra rotas em `Register(r, authMW)`

Composição única em `main.go`. Handler nunca acessa repo diretamente.

## Resposta HTTP

Sempre via `httputil`. Envelope: `{"data": ..., "error": null}` ou `{"data": null, "error": {"code": "SNAKE_CASE", "message": "..."}}`.

## JWT

- Algoritmo RS256; chaves em `backend/keys/`
- Access token: 15 min; Refresh token: armazenado com hash no banco
- `auth.OwnerIDFromCtx(ctx)` extrai o UUID do owner do contexto

## Migrations

Numeradas `000001_..._name.up.sql` / `.down.sql`. Rodam automaticamente na startup via `db.RunMigrations`. Tabelas: `users`, `refresh_tokens`, `properties`, `units`, `tenants`, `leases`, `payments`, `expenses`.

## Módulos

| Módulo | Docs |
|---|---|
| identity | [internal/identity/CLAUDE.md](internal/identity/CLAUDE.md) |
| property + unit | [internal/property/CLAUDE.md](internal/property/CLAUDE.md) |
| tenant | [internal/tenant/CLAUDE.md](internal/tenant/CLAUDE.md) |
| lease | [internal/lease/CLAUDE.md](internal/lease/CLAUDE.md) |
| payment | [internal/payment/CLAUDE.md](internal/payment/CLAUDE.md) |
| expense | [internal/expense/CLAUDE.md](internal/expense/CLAUDE.md) |
| pkg/ | [pkg/CLAUDE.md](pkg/CLAUDE.md) |

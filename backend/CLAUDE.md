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
| `CORS_ALLOWED_ORIGINS` | Lista separada por vírgula de origens CORS (default: vazio) |
| `APP_TIMEZONE` | Fuso para "hoje"/mês corrente nas métricas (default: `America/Sao_Paulo`) |
| `APP_PUBLIC_URL` | URL pública do frontend; base do link `/p/<token>` da cobrança (sem ela, `POST /payments/{id}/link` dá 422) |
| `PAYMENT_PROVIDER` | Provider de pagamento: `asaas`, `sicoob`, `bradesco`, `itau`, `mock` |

## Rotas Públicas

```
GET  /health                    # ping no banco
GET  /swagger/*                 # Swagger UI
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/2fa/verify
POST /api/v1/payments/webhook   # webhook do provider de pagamento
GET  /api/v1/public/payments/{token}          # cobrança pelo link (sem login)
GET  /api/v1/public/payments/{token}/pix      # Pix do dia
GET  /api/v1/public/payments/{token}/receipt  # recibo (só paga), sem documentos nem endereço
POST /api/v1/public/payments/{token}/report   # "já paguei" (multipart, comprovante opcional)
```

## Middlewares Globais (aplicados em main.go)

- `ratelimit.NewMiddleware` — token bucket por IP (100/s) e por usuário (200/s)
- CORS com `CORS_ALLOWED_ORIGINS`

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

Numeradas `000001_..._name.up.sql` / `.down.sql`. Rodam automaticamente na startup via `db.RunMigrations`. Última: `000053_pix_settings`.

Tabelas e alterações adicionadas (000009–000045): `tenant.person_type`, `lease.fiscal_fields`, `payment.breakdown`, `lease_readjustments`, `irrf_brackets`, `financial_config`, `payment.charge_fields`, `lease.payment_day`, `support_tickets`, `audit_logs`, `user_roles`, `2fa_fields`, `temp_2fa_tokens`, `documents`, `notifications`, `index_values`, `import_history`, `user_profiles`, `user_notification_preferences`, `organizations` (+ `organization_id` em `support_tickets` e `audit_logs`, FK NOT NULL), índices do dashboard, campos de unidade/endereço/notas, sem sobreposição de contratos, campos de despesa, `organization_id` em `financial_config` e reajustes, `inspections`, `inspection_items`, `inspection_photos`, `properties` (tipo COMMERCIAL, `number`, `complement`), `units.reference_rent`, `leases` (`adjustment_index`, `adjustment_month`, `end_reason`), `payment_events`, `receipt_counters` colunas de pagamento manual/recibo em `payments`, `payment_links` (hash do token) e colunas do aviso `reported_*`/`proof_path` em `payments`.

## Módulos

| Módulo | Docs |
|---|---|
| identity | [internal/identity/CLAUDE.md](internal/identity/CLAUDE.md) |
| property + unit | [internal/property/CLAUDE.md](internal/property/CLAUDE.md) |
| tenant | [internal/tenant/CLAUDE.md](internal/tenant/CLAUDE.md) |
| lease | [internal/lease/CLAUDE.md](internal/lease/CLAUDE.md) |
| payment | [internal/payment/CLAUDE.md](internal/payment/CLAUDE.md) |
| expense | [internal/expense/CLAUDE.md](internal/expense/CLAUDE.md) |
| inspection | [internal/inspection/CLAUDE.md](internal/inspection/CLAUDE.md) |
| organization | [internal/organization/CLAUDE.md](internal/organization/CLAUDE.md) |
| dashboard | [internal/dashboard/CLAUDE.md](internal/dashboard/CLAUDE.md) |
| importexport | [internal/importexport/CLAUDE.md](internal/importexport/CLAUDE.md) |
| fiscal | [internal/fiscal/CLAUDE.md](internal/fiscal/CLAUDE.md) |
| audit | [internal/audit/CLAUDE.md](internal/audit/CLAUDE.md) |
| rbac | [internal/rbac/CLAUDE.md](internal/rbac/CLAUDE.md) |
| notification | [internal/notification/CLAUDE.md](internal/notification/CLAUDE.md) |
| support | [internal/support/CLAUDE.md](internal/support/CLAUDE.md) |
| document | [internal/document/CLAUDE.md](internal/document/CLAUDE.md) |
| settings | [internal/settings/CLAUDE.md](internal/settings/CLAUDE.md) |
| ratelimit | [internal/ratelimit/CLAUDE.md](internal/ratelimit/CLAUDE.md) |
| pkg/ | [pkg/CLAUDE.md](pkg/CLAUDE.md) |

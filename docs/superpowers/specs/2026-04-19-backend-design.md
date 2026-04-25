# Backend Design — InquilinoTop

**Data:** 2026-04-19
**Branch:** backend/planning
**Status:** Aprovado

---

## Contexto

O InquilinoTop é uma plataforma de gestão imobiliária voltada ao **pequeno empresário** com 3–30 unidades. O foco é eliminar burocracia — diferente do Quinto Andar, que é uma intermediadora de grande escala. O InquilinoTop é uma ferramenta do proprietário (SaaS), não uma plataforma de busca.

Este documento define a arquitetura do backend Go que **substituirá o acesso direto ao Supabase** pelo frontend Next.js.

---

## Comparativo com Quinto Andar

| Quinto Andar | InquilinoTop |
|---|---|
| Intermediadora (cobra % do aluguel) | SaaS fixo para proprietários |
| Foco no locatário (busca, score, garantia) | Foco no proprietário (gestão, financeiro) |
| Grande escala, processos longos | Pequeno empresário, agilidade máxima |
| Pagamentos internos na plataforma | Integração com Pix/Asaas/Iugu |
| Notificações internas | Notificações diretas (WhatsApp/email) |

**Lacuna explorada:** proprietário com 3–30 unidades não tem ferramenta adequada — o Quinto Andar é grande demais, planilhas são precárias.

---

## Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---|---|---|
| Linguagem | Go | Performance, baixo custo de infra, bom para APIs |
| Banco | PostgreSQL (Supabase como managed DB) | Supabase vira só banco — sem RLS, sem Auth |
| Framework HTTP | `chi` | Leve, idiomático, sem magia |
| Driver banco | `pgx` | Nativo PostgreSQL, sem ORM pesado |
| Migrations | `golang-migrate` | SQL puro versionado |
| Auth | JWT RS256 próprio + refresh token | Sem dependência do Supabase Auth |
| Fila assíncrona | PostgreSQL LISTEN/NOTIFY + tabela `jobs` | Sem Redis extra para operar |
| Deploy | Railway / Fly.io + Docker | Zero configuração de servidor |
| Logs | `slog` (stdlib Go 1.21+) | Sem lib externa |
| Erros produção | Sentry Go SDK | Captura panics e erros não tratados |

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js 15                           │
│              (Server Actions → HTTP REST API)               │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / JSON
┌────────────────────────▼────────────────────────────────────┐
│                    cmd/api  (Go HTTP)                        │
│                                                             │
│  /internal/identity    /internal/property                   │
│  /internal/lease       /internal/finance                    │
│  /internal/tenant      /internal/notification               │
│  /internal/integration                                      │
│                                                             │
│  Cada domínio: handler → service → repository               │
└──────────┬──────────────────────────┬───────────────────────┘
           │ SQL (pgx)                │ INSERT INTO jobs
┌──────────▼──────────┐   ┌──────────▼───────────────────────┐
│   PostgreSQL        │   │    cmd/worker  (Go)              │
│   (Supabase DB)     │   │                                  │
│                     │   │  • Notificações (email/WhatsApp) │
│  Isolamento por     │   │  • Geração de boleto/Pix         │
│  owner_id na API    │   │  • Relatórios PDF/Excel          │
└─────────────────────┘   │  • Scheduler de alertas         │
                          └──────────────────────────────────┘
```

---

## Estrutura de Pacotes

```
inquilino-top-api/
├── cmd/
│   ├── api/            → main.go da API HTTP
│   └── worker/         → main.go do worker assíncrono
├── internal/
│   ├── identity/       → auth, JWT, usuários, planos
│   ├── property/       → properties + units
│   ├── tenant/
│   ├── lease/
│   ├── finance/        → payments + expenses + relatórios
│   ├── notification/
│   └── integration/    → Asaas/Iugu
├── pkg/
│   ├── db/             → conexão pgx, migrations
│   ├── queue/          → publish/subscribe PostgreSQL
│   ├── auth/           → middleware JWT
│   └── httputil/       → response helpers, erros padronizados
├── migrations/         → arquivos .sql versionados
├── Dockerfile
└── docker-compose.yml
```

**Padrão interno por domínio:**
```
/internal/<domínio>/
  handler.go      → recebe HTTP, valida input, chama service
  service.go      → lógica de negócio, orquestra repositórios
  repository.go   → queries SQL puras (pgx), sem lógica
  model.go        → structs do domínio
```

---

## Autenticação

Auth próprio dentro da API Go. Supabase Auth é removido completamente.

**Endpoints:**
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

**Tokens:**
- **Access token:** JWT RS256, expiração 15min
- **Refresh token:** UUID opaco, salvo no banco, expiração 30 dias, revogável

**Tabelas:**
```sql
users          → id, email, password_hash, plan, created_at
refresh_tokens → id, user_id, token_hash, expires_at, revoked_at
```

**Middleware pipeline:**
```
ValidateJWT → ExtractTenant (injeta owner_id no ctx) → Handler
```

Todo repository recebe `ownerID` como parâmetro — nunca do body do request.

**Migração de usuários existentes:** exportar `user.id` do Supabase Auth e recriar com fluxo de reset de senha no primeiro acesso.

**White-label futuro:** tabela `tenants` com `plan`, `custom_domain`, `branding` — adicionada sem quebrar contratos existentes.

---

## API Contracts

Todas as rotas sob `/api/v1/`. Padrão de resposta uniforme:
```json
{ "data": {...}, "error": null }
{ "data": null, "error": { "code": "LEASE_NOT_ACTIVE", "message": "..." } }
```

**Identity**
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

**Properties & Units**
```
GET    /api/v1/properties
POST   /api/v1/properties
GET    /api/v1/properties/:id
PUT    /api/v1/properties/:id
DELETE /api/v1/properties/:id
POST   /api/v1/properties/:id/units
PUT    /api/v1/units/:id
DELETE /api/v1/units/:id
GET    /api/v1/units/:id          → unit + lease ativa + expenses
```

**Tenants**
```
GET    /api/v1/tenants
POST   /api/v1/tenants
GET    /api/v1/tenants/:id
PUT    /api/v1/tenants/:id
DELETE /api/v1/tenants/:id
```

**Leases**
```
GET    /api/v1/leases
POST   /api/v1/leases
GET    /api/v1/leases/:id
PUT    /api/v1/leases/:id
POST   /api/v1/leases/:id/end
POST   /api/v1/leases/:id/renew
```

**Finance**
```
GET    /api/v1/payments
POST   /api/v1/payments
PUT    /api/v1/payments/:id
POST   /api/v1/payments/:id/confirm

GET    /api/v1/expenses
POST   /api/v1/expenses
PUT    /api/v1/expenses/:id
POST   /api/v1/expenses/:id/confirm

GET    /api/v1/reports/financial
GET    /api/v1/reports/financial/export?format=pdf|xlsx
```

**Dashboard**
```
GET    /api/v1/dashboard
```

**Notifications**
```
GET    /api/v1/notifications/settings
PUT    /api/v1/notifications/settings
```

**Integrations**
```
POST   /api/v1/integrations/asaas/connect
POST   /api/v1/integrations/asaas/disconnect
POST   /api/v1/payments/:id/generate-boleto
POST   /api/v1/payments/:id/generate-pix
```

---

## Worker e Filas Assíncronas

**Tabela de jobs:**
```sql
CREATE TABLE jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         TEXT NOT NULL,
  payload      JSONB NOT NULL,
  status       TEXT DEFAULT 'PENDING', -- PENDING, PROCESSING, DONE, FAILED
  attempts     INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  run_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

Consumo via `SELECT ... FOR UPDATE SKIP LOCKED` — sem race condition, sem Redis.

**Tipos de jobs:**
```
SEND_EMAIL_PAYMENT_DUE      → scheduler diário (3 dias antes do vencimento)
SEND_WHATSAPP_PAYMENT_DUE   → idem
SEND_EMAIL_LEASE_EXPIRING   → scheduler (30 dias antes do fim do contrato)
GENERATE_BOLETO             → criado ao confirmar pagamento via Asaas
GENERATE_PIX                → idem para Pix
EXPORT_REPORT_PDF           → criado ao solicitar relatório
EXPORT_REPORT_XLSX          → idem
```

**Scheduler interno (cron no Worker):**
- Todo dia 08:00 → verifica payments com `due_date` em 3 dias → enfileira notificações
- Todo dia 08:00 → verifica leases com `end_date` em 30 dias → enfileira alertas

**Retry:** após `max_attempts`, status vira `FAILED` e gera alerta no dashboard do owner.

---

## Deploy e Observabilidade

**Local (docker-compose):**
```
api        → Go HTTP :8080
worker     → Go worker process
postgres   → PostgreSQL 16
```

**Produção (Railway/Fly.io):**
```
inquilino-api    → Dockerfile /cmd/api
inquilino-worker → Dockerfile /cmd/worker
Banco            → Supabase PostgreSQL (managed)
```

**Variáveis de ambiente:**
```
DATABASE_URL
JWT_PRIVATE_KEY
JWT_PUBLIC_KEY
ASAAS_API_KEY
SMTP_HOST / SMTP_USER / SMTP_PASS
WHATSAPP_API_KEY
APP_ENV
```

**Observabilidade:**
- Logs JSON via `slog` (stdlib Go 1.21+)
- `GET /health` → status da API + conexão com banco
- `GET /metrics` → Prometheus (requests/seg, latência, jobs na fila)
- Sentry Go SDK para erros não tratados e panics

**Migrations:** `golang-migrate` roda no startup antes de servir tráfego. Arquivos SQL em `/migrations`, versionados no git.

**CI/CD:**
```
push → GitHub Actions → go test ./... → go build → docker build → deploy Railway
```

---

## Domínios e Fases de Implementação

| Fase | Domínios | Entregável |
|---|---|---|
| 1 | identity, property, tenant | CRUD base + auth próprio |
| 2 | lease, finance | Contratos e pagamentos |
| 3 | notification, worker | Alertas email/WhatsApp |
| 4 | integration | Boleto/Pix via Asaas |
| 5 | reports | PDF/Excel exportável |

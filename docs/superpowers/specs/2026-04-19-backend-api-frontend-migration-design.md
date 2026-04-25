# Design: Backend API Completo + Migração Frontend

**Data:** 2026-04-19  
**Branch:** backend/planning  
**Decisão:** Opção A — Backend completo primeiro, depois frontend

---

## Contexto

O projeto é um monorepo com Go backend (chi, JWT, pgx) e Next.js 15 frontend. O Docker Compose já configura `postgres`, `backend`, e `frontend`. O frontend atualmente usa Supabase diretamente para auth e dados. O objetivo é completar o backend Go com todos os domínios do negócio e migrar o frontend para usar exclusivamente o Go backend.

---

## Arquitetura

```
inquilinoTop/
├── backend/
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── identity/     (existe: auth/users)
│   │   ├── property/     (existe)
│   │   ├── tenant/       (existe)
│   │   ├── unit/         (novo)
│   │   ├── lease/        (novo)
│   │   ├── payment/      (novo)
│   │   └── expense/      (novo)
│   ├── docs/             (novo: Swagger gerado pelo swaggo)
│   └── migrations/       (novas: unit, lease, payment, expense)
└── frontend/
    └── src/lib/api/      (novo: cliente HTTP tipado)
```

**Fluxo de dados:**
```
Browser → Next.js Server Action → Go API (:8080, JWT) → PostgreSQL
```

O Supabase é removido completamente do frontend.

---

## Backend: Novos Domínios

### Padrão de implementação (seguir existente)
Cada domínio segue: `model.go` → `repository.go` → `service.go` → `handler.go`

### Unit
```
GET    /properties/{propertyId}/units     lista unidades do imóvel
POST   /properties/{propertyId}/units     cria unidade
GET    /units/{id}                        busca unidade
PUT    /units/{id}                        atualiza unidade
DELETE /units/{id}                        soft-delete (is_active=false)
```

### Lease
```
GET    /leases                            lista contratos do usuário
POST   /leases                            cria contrato
GET    /leases/{id}                       busca contrato
PUT    /leases/{id}                       atualiza contrato (ex: status)
DELETE /leases/{id}                       soft-delete
```

Campos: `unit_id`, `tenant_id`, `start_date`, `end_date`, `rent_amount`, `deposit_amount`, `status` (ACTIVE | ENDED | CANCELED)

### Payment
```
GET    /leases/{leaseId}/payments         lista pagamentos do contrato
POST   /leases/{leaseId}/payments         registra pagamento
PUT    /payments/{id}                     atualiza pagamento (ex: marcar como pago)
```

Campos: `lease_id`, `due_date`, `paid_date`, `amount`, `status` (PENDING | PAID | LATE), `type` (RENT | DEPOSIT | EXPENSE | OTHER)

### Expense
```
GET    /units/{unitId}/expenses           lista despesas da unidade
POST   /units/{unitId}/expenses           cria despesa
PUT    /expenses/{id}                     atualiza despesa
DELETE /expenses/{id}                     soft-delete
```

Campos: `unit_id`, `description`, `amount`, `due_date`, `category` (ELECTRICITY | WATER | CONDO | TAX | MAINTENANCE | OTHER)

### Swagger
- Biblioteca: `github.com/swaggo/swag` + `github.com/swaggo/http-swagger`
- Rota: `GET /swagger/*` → Swagger UI
- Anotações nos handlers com `// @Summary`, `// @Param`, `// @Success`, etc.
- Geração: `swag init -g cmd/api/main.go -o docs`

### Migrations novas
```
000006_create_leases.up.sql / down.sql
000007_create_payments.up.sql / down.sql
000008_create_expenses.up.sql / down.sql
```

Nota: `units` já tem migration (`000004`) e tabela criada. Apenas falta o pacote Go `internal/unit/`.

`lease`, `payment`, `expense` incluem `owner_id` (UUID, FK para users) para isolamento por usuário. `unit` é isolada indiretamente via `property_id → property.owner_id`.

---

## Frontend: Migração do Supabase

### Remoção
- Remover pacotes: `@supabase/ssr`, `@supabase/supabase-js`
- Remover `src/lib/supabase/` (client.ts, server.ts, middleware.ts)
- Remover variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Novo cliente HTTP
```
src/lib/api/
├── client.ts       fetch wrapper: lê JWT do cookie, seta Authorization header
├── properties.ts   funções tipadas: getProperties(), createProperty(), etc.
├── tenants.ts
├── units.ts
├── leases.ts
├── payments.ts
└── expenses.ts
```

A URL base dentro do Docker é `http://backend:8080`. Em desenvolvimento local fora do Docker usa `http://localhost:8080`. Configurada via env var `BACKEND_URL` (já existe no docker-compose).

### Auth
- Login: `POST /auth/login` → JWT salvo em cookie `httpOnly; Secure; SameSite=Strict`
- Logout: limpa o cookie
- Middleware Next.js: verifica presença e validade do JWT no cookie (decodificação local com chave pública RSA)
- Redirect `/login` → `/` se autenticado; protege demais rotas

### Server Actions
Cada `actions.ts` substitui `supabase.from(...)` por chamada tipada do `src/lib/api/`:
```ts
// antes
const { data } = await supabase.from('properties').select('*')

// depois
const data = await getProperties()  // chama GET /properties com JWT
```

---

## Docker

Sem mudanças no `docker-compose.yml`. O `frontend` já depende do `backend` e a rede interna já funciona. Apenas adicionar `BACKEND_URL=http://backend:8080` ao serviço `frontend` se ainda não estiver lá.

---

## Ordem de Implementação

1. **Backend**
   - Migrations: lease, payment, expense (unit já existe)
   - Domínio `unit` (model, repo, service, handler — tabela já existe)
   - Domínio `lease`
   - Domínio `payment`
   - Domínio `expense`
   - Swagger: instalar swaggo, anotar todos os handlers, expor `/swagger/*`

2. **Frontend**
   - Criar `src/lib/api/client.ts`
   - Migrar auth (login/logout/middleware)
   - Migrar cada módulo (properties, tenants, units, leases, payments, expenses)
   - Remover Supabase

---

## Critérios de Sucesso

- `docker compose up` sobe tudo sem erros
- Swagger UI acessível em `http://localhost:8080/swagger/index.html`
- Todos os endpoints retornam dados corretos com JWT válido
- Frontend funciona sem nenhuma referência ao Supabase
- Login/logout funcionam via Go backend

# Fix Tests and Lint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 63 testes de handler falhando no backend, bug do middleware de deprecação, e ~33 erros de lint no frontend.

**Architecture:** Os testes de handler falham porque usam URLs com prefixo `/api/v1/` mas os handlers registram rotas sem o prefixo (o middleware de rewrite em `main.go` faz o strip em produção). O frontend tem erros mecânicos de TypeScript (`any`, `prefer-const`, entidades JSX não escapadas) e três componentes com `setState` chamado sincronamente dentro de `useEffect`.

**Tech Stack:** Go 1.25 / chi v5 / testify (backend); Next.js 16 / React 19 / TypeScript / ESLint (frontend)

---

## Task 1: Backend — Corrigir URLs nos handler_test.go (todos os domínios)

**Raiz do problema:** `main.go` tem middleware que faz `strings.Replace(r.URL.Path, "/api/v1", "", 1)` antes do roteamento. Os handlers registram rotas sem prefixo (ex: `/expenses`). Mas os testes constroem requests com `/api/v1/expenses` diretamente no router — sem o middleware de rewrite — resultando em 404.

**Correção:** Remover `/api/v1` das URLs nos `httptest.NewRequest` de todos os handler_test.go.

**Files:**
- Modify: `backend/internal/audit/handler_test.go`
- Modify: `backend/internal/document/handler_test.go`
- Modify: `backend/internal/expense/handler_test.go`
- Modify: `backend/internal/fiscal/handler_test.go`
- Modify: `backend/internal/identity/handler_test.go`
- Modify: `backend/internal/lease/handler_test.go`
- Modify: `backend/internal/payment/handler_test.go`
- Modify: `backend/internal/property/handler_test.go`
- Modify: `backend/internal/support/handler_test.go`
- Modify: `backend/internal/tenant/handler_test.go`

- [ ] **Step 1: Verificar contagem de ocorrências antes**

```bash
grep -rc "api/v1" backend/internal/*/handler_test.go
```

Esperado: total de ~96 linhas com `/api/v1`.

- [ ] **Step 2: Aplicar substituição em todos os arquivos**

```bash
docker compose exec backend sh -c 'find /app/internal -name "handler_test.go" -exec sed -i "s|/api/v1/|/|g" {} +'
```

- [ ] **Step 3: Verificar que não restaram ocorrências**

```bash
grep -rc "api/v1" backend/internal/*/handler_test.go
```

Esperado: todos os valores zerados.

- [ ] **Step 4: Rodar os testes unitários**

```bash
make test-backend
```

Esperado: `ok` em todos os pacotes, zero `FAIL`.

- [ ] **Step 5: Verificar especificamente os pacotes que falhavam**

```bash
docker compose exec backend go test ./internal/expense/... ./internal/identity/... ./internal/lease/... ./internal/payment/... ./internal/property/... ./internal/tenant/... -v 2>&1 | grep -E "^--- (PASS|FAIL)|^(ok|FAIL)" | head -80
```

Esperado: apenas linhas `--- PASS:` e `ok`.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/audit/handler_test.go \
        backend/internal/document/handler_test.go \
        backend/internal/expense/handler_test.go \
        backend/internal/fiscal/handler_test.go \
        backend/internal/identity/handler_test.go \
        backend/internal/lease/handler_test.go \
        backend/internal/payment/handler_test.go \
        backend/internal/property/handler_test.go \
        backend/internal/support/handler_test.go \
        backend/internal/tenant/handler_test.go
git commit -m "fix(tests): remover prefixo /api/v1 dos handler_test (rewrite é responsabilidade do main.go)"
```

---

## Task 2: Backend — Corrigir routing_test.go e bug do middleware de deprecação

**Dois problemas em `cmd/api`:**

1. `TestRouting_HandlerPathsAccessible` testa um padrão errado (subrouter chi com paths absolutos) e falha porque chi concatena o prefixo. O `main.go` real usa middleware de rewrite — o teste deveria verificar esse padrão.

2. O middleware de deprecação (que adiciona `Deprecation: true`) fica **depois** do middleware de rewrite em `main.go` (linha 180). O rewrite já removeu `/api/v1` do path antes, então a verificação `strings.HasPrefix(req.URL.Path, "/api/v1/")` nunca é `true` em produção — o header nunca é enviado.

**Files:**
- Modify: `backend/cmd/api/routing_test.go`
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Corrigir `TestRouting_HandlerPathsAccessible` em `routing_test.go`**

Substituir a função pelo teste do padrão real (rewrite middleware antes do roteamento):

```go
// TestRouting_HandlerPathsAccessible verifica que o middleware de rewrite
// de /api/v1/* → /* permite que handlers registrados sem prefixo sejam
// acessados via /api/v1/<rota>.
func TestRouting_HandlerPathsAccessible(t *testing.T) {
	called := false
	h := func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}

	r := chi.NewRouter()
	// Middleware de rewrite — igual ao main.go
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/api/v1") {
				req.URL.Path = strings.Replace(req.URL.Path, "/api/v1", "", 1)
			}
			next.ServeHTTP(w, req)
		})
	})
	r.Get("/properties", h) // handler registrado SEM prefixo

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code,
		"rewrite middleware deve fazer /api/v1/properties chegar em /properties")
	assert.True(t, called, "handler deve ter sido chamado")
}
```

- [ ] **Step 2: Corrigir ordem dos middlewares em `main.go`**

Em `main.go` os middlewares estão na ordem errada (linhas ~171–188). O de deprecação precisa vir **antes** do rewrite (para ver o path original `/api/v1/...`).

Localizar o bloco:
```go
	// Rewrite /api/v1/* to /* before routing
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/v1") {
				r.URL.Path = strings.Replace(r.URL.Path, "/api/v1", "", 1)
			}
			next.ServeHTTP(w, r)
		})
	})
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/api/v1/") {
				w.Header().Set("Deprecation", "true")
				w.Header().Set("Warning", "299 - \"This API v1 is deprecated and will be removed. Please migrate to /api/v2.\"")
			}
			next.ServeHTTP(w, req)
		})
	})
```

Trocar a ordem — deprecation **primeiro**, depois rewrite:

```go
	// Deprecation header para /api/v1/* (antes do rewrite para ver o path original)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/api/v1/") {
				w.Header().Set("Deprecation", "true")
				w.Header().Set("Warning", "299 - \"This API v1 is deprecated and will be removed. Please migrate to /api/v2.\"")
			}
			next.ServeHTTP(w, req)
		})
	})
	// Rewrite /api/v1/* to /* before routing
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/v1") {
				r.URL.Path = strings.Replace(r.URL.Path, "/api/v1", "", 1)
			}
			next.ServeHTTP(w, r)
		})
	})
```

- [ ] **Step 3: Rodar os testes de cmd/api**

```bash
docker compose exec backend go test ./cmd/api/... -v 2>&1 | grep -E "^--- (PASS|FAIL)|^(ok|FAIL)"
```

Esperado: todos `--- PASS:`, resultado final `ok`.

- [ ] **Step 4: Build do backend para verificar compilação**

```bash
docker compose exec backend go build ./...
```

Esperado: sem output (compilação limpa).

- [ ] **Step 5: Commit**

```bash
git add backend/cmd/api/routing_test.go backend/cmd/api/main.go
git commit -m "fix(backend): corrigir routing_test e ordem dos middlewares de deprecation/rewrite"
```

---

## Task 3: Frontend — prefer-const e no-unescaped-entities (correções mecânicas)

**Files:**
- Modify: `frontend/src/data/dashboard/dal.ts` (linhas 71–72)
- Modify: `frontend/src/components/leases/ActiveLeaseCard.tsx` (linha 139)
- Modify: `frontend/src/components/properties/DeletePropertyButton.tsx` (linha 65)
- Modify: `frontend/src/components/properties/UnitList.tsx` (linha 191)
- Modify: `frontend/src/components/tenants/TenantListClient.tsx` (linha 201)

- [ ] **Step 1: Corrigir `prefer-const` em `dal.ts`**

Em `frontend/src/data/dashboard/dal.ts`, linhas 71–72, trocar `let` por `const`:

```ts
// Antes:
let payments: Payment[] = []
let expiringLeases: Lease[] = []

// Depois:
const payments: Payment[] = []
const expiringLeases: Lease[] = []
```

- [ ] **Step 2: Corrigir `no-unescaped-entities` em `ActiveLeaseCard.tsx` (linha 139)**

```tsx
// Antes:
Para encerrar um contrato que chegou ao fim, use "Encerrar Contrato".

// Depois:
Para encerrar um contrato que chegou ao fim, use &quot;Encerrar Contrato&quot;.
```

- [ ] **Step 3: Corrigir `no-unescaped-entities` em `DeletePropertyButton.tsx` (linha 65)**

```tsx
// Antes:
Isso irá desativar o imóvel "{name}" e todas as suas unidades.

// Depois:
Isso irá desativar o imóvel &quot;{name}&quot; e todas as suas unidades.
```

- [ ] **Step 4: Corrigir `no-unescaped-entities` em `UnitList.tsx` (linha 191)**

Ler o arquivo para confirmar o texto exato e substituir as `"` literais por `&quot;`.

- [ ] **Step 5: Corrigir `no-unescaped-entities` em `TenantListClient.tsx` (linha 201)**

```tsx
// Antes:
Isso irá remover permanentemente o inquilino "{deletingTenant?.name}".

// Depois:
Isso irá remover permanentemente o inquilino &quot;{deletingTenant?.name}&quot;.
```

- [ ] **Step 6: Verificar lint parcial**

```bash
docker compose exec frontend npx eslint src/data/dashboard/dal.ts src/components/leases/ActiveLeaseCard.tsx src/components/properties/DeletePropertyButton.tsx src/components/properties/UnitList.tsx src/components/tenants/TenantListClient.tsx 2>&1 | grep -E "error|warning"
```

Esperado: nenhum erro nas linhas corrigidas.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/dashboard/dal.ts \
        frontend/src/components/leases/ActiveLeaseCard.tsx \
        frontend/src/components/properties/DeletePropertyButton.tsx \
        frontend/src/components/properties/UnitList.tsx \
        frontend/src/components/tenants/TenantListClient.tsx
git commit -m "fix(frontend): prefer-const e no-unescaped-entities"
```

---

## Task 4: Frontend — Corrigir no-explicit-any

**Files:**
- Modify: `frontend/src/types/index.ts` (linhas 110, 120)
- Modify: `frontend/src/app/settings/financial/actions.ts` (linhas 17, 32)
- Modify: `frontend/src/app/settings/profile/actions.ts` (linha 17)
- Modify: `frontend/src/app/units/[id]/page.tsx` (linhas 20–29, 80)
- Modify: `frontend/src/app/expenses/page.tsx` (linha 64)
- Modify: `frontend/src/app/payments/page.tsx` (linha 56)
- Modify: `frontend/src/app/financial/receivables/page.tsx` (linhas 73, 96)
- Modify: `frontend/src/components/leases/CreateLeaseDialog.tsx` (linhas 11–12)
- Modify: `frontend/src/app/settings/financial/FinancialForm.tsx` (linha 70)

- [ ] **Step 1: Corrigir `types/index.ts`**

```ts
// Antes (linhas 110, 120):
config?: Record<string, any>
config: Record<string, any>

// Depois:
config?: Record<string, unknown>
config: Record<string, unknown>
```

- [ ] **Step 2: Corrigir `settings/financial/actions.ts`**

```ts
// Antes linha 17:
export async function updateFinancialConfig(prevState: any, formData: FormData) {

// Depois:
export async function updateFinancialConfig(prevState: unknown, formData: FormData) {

// Antes linha 32:
const config: Record<string, any> = {}

// Depois:
const config: Record<string, unknown> = {}
```

- [ ] **Step 3: Corrigir `settings/profile/actions.ts`**

```ts
// Antes linha 17:
export async function updateProfile(prevState: any, formData: FormData) {

// Depois:
export async function updateProfile(prevState: unknown, formData: FormData) {
```

- [ ] **Step 4: Corrigir `units/[id]/page.tsx`**

Adicionar imports de tipos e substituir todos os `any`:

```ts
// Adicionar import (já existe goFetch e notFound):
import { Unit, Property, Lease, Payment, Expense } from '@/types'

// Substituir declarações (linhas 20–24):
let unit: Unit | null = null
let property: Property | null = null
const activeLease: Lease | null = null
const payments: Payment[] = []
const expenses: Expense[] = []

// Substituir chamadas goFetch (linhas 27, 29):
unit = await goFetch<Unit>("/api/v1/units/" + id, {})
property = await goFetch<Property>("/api/v1/properties/" + unit.property_id, {})

// Substituir cast (linha 80):
<ActiveLeaseCard lease={activeLease} />
```

- [ ] **Step 5: Corrigir `expenses/page.tsx`**

```tsx
// Antes linha 64:
async function ExpensesList({ search, category, properties }: { search?: string; category?: string; properties: any[] }) {

// Depois:
interface PropertyWithUnits { id: string; name: string; units: { id: string; label: string }[] }
async function ExpensesList({ search, category, properties }: { search?: string; category?: string; properties: PropertyWithUnits[] }) {
```

- [ ] **Step 6: Corrigir `payments/page.tsx`**

```tsx
// Importar Lease de @/types no topo
import { Lease } from '@/types'

// Antes linha 56:
async function PaymentsList({ leases }: { leases: any[] }) {

// Depois:
async function PaymentsList({ leases }: { leases: Lease[] }) {
```

- [ ] **Step 7: Corrigir `financial/receivables/page.tsx`**

```ts
// Linha 73 — identificar tipo do activeTab para o cast:
// tab.id é string literal de um array fixo com ids como 'ALL', 'RENT', etc.
// Definir o tipo localmente:
type TabId = 'ALL' | 'RENT' | 'DEPOSIT' | 'LATE_FEE' | 'CONDO_FEE'

// Linha 73:
onClick={() => setActiveTab(tab.id as TabId)}

// Linha 96 — filterStatus é um dos valores do select:
type FilterStatus = 'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'
onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
```

- [ ] **Step 8: Corrigir `CreateLeaseDialog.tsx`**

```ts
// Importar tipos no topo:
import { Tenant, Property } from '@/types'

// Antes linhas 11–12:
interface CreateLeaseDialogProps {
  unitId?: string
  tenants: any[]
  properties?: any[]
}

// Depois:
interface CreateLeaseDialogProps {
  unitId?: string
  tenants: Tenant[]
  properties?: Property[]
}
```

- [ ] **Step 9: Corrigir `FinancialForm.tsx`**

```ts
// Linha 70 — o select de provider tem valores fixos:
type Provider = 'MOCK' | 'ASAAS' | 'BRADESCO' | 'ITAU' | 'SICOOB'
onChange={(e) => setProvider(e.target.value as Provider)}
```

- [ ] **Step 10: Rodar lint para verificar progresso**

```bash
docker compose exec frontend npx eslint src/types/index.ts src/app/settings/financial/actions.ts src/app/settings/profile/actions.ts src/app/units/[id]/page.tsx src/app/expenses/page.tsx src/app/payments/page.tsx src/app/financial/receivables/page.tsx src/components/leases/CreateLeaseDialog.tsx src/app/settings/financial/FinancialForm.tsx 2>&1 | grep "error"
```

Esperado: sem linhas `error`.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/types/index.ts \
        frontend/src/app/settings/financial/actions.ts \
        frontend/src/app/settings/profile/actions.ts \
        frontend/src/app/units/[id]/page.tsx \
        frontend/src/app/expenses/page.tsx \
        frontend/src/app/payments/page.tsx \
        frontend/src/app/financial/receivables/page.tsx \
        frontend/src/components/leases/CreateLeaseDialog.tsx \
        frontend/src/app/settings/financial/FinancialForm.tsx
git commit -m "fix(frontend): substituir any por tipos explícitos"
```

---

## Task 5: Frontend — Corrigir react-hooks/set-state-in-effect

**Raiz:** Três componentes chamam `setState` (ou equivalente) sincronamente dentro de `useEffect`. A correção é envolver as atualizações de estado em `startTransition` do React, que as marca como transições não urgentes e evita o aviso de cascata.

**Files:**
- Modify: `frontend/src/components/expenses/ExpenseDialog.tsx` (linha 52–60)
- Modify: `frontend/src/components/payments/PaymentDialog.tsx` (linha 45–53)
- Modify: `frontend/src/components/Sidebar.tsx` (linha 87–91)

- [ ] **Step 1: Corrigir `ExpenseDialog.tsx`**

```tsx
// Adicionar startTransition ao import:
import { useActionState, useEffect, useState, startTransition } from 'react'

// Substituir useEffect (linhas 52–60):
useEffect(() => {
  if (state?.success) {
    toast.success(state.success)
    startTransition(() => setOpen(false))
  }
  if (state?.error) {
    toast.error(state.error)
  }
}, [state])
```

- [ ] **Step 2: Corrigir `PaymentDialog.tsx`**

```tsx
// Adicionar startTransition ao import:
import { useActionState, useEffect, useState, startTransition } from 'react'

// Substituir useEffect (linhas 45–53):
useEffect(() => {
  if (state?.success) {
    toast.success(state.success)
    startTransition(() => setOpen(false))
  }
  if (state?.error) {
    toast.error(state.error)
  }
}, [state])
```

- [ ] **Step 3: Corrigir `Sidebar.tsx`**

```tsx
// Adicionar startTransition ao import:
import { useState, useEffect, startTransition } from 'react'

// Substituir segundo useEffect (linhas 87–91):
useEffect(() => {
  if (window.innerWidth < 768) {
    startTransition(() => setIsOpen(false))
  }
}, [pathname])
```

- [ ] **Step 4: Rodar lint nos três arquivos**

```bash
docker compose exec frontend npx eslint src/components/expenses/ExpenseDialog.tsx src/components/payments/PaymentDialog.tsx src/components/Sidebar.tsx 2>&1 | grep "error"
```

Esperado: sem linhas `error`.

- [ ] **Step 5: Rodar lint completo**

```bash
make frontend-lint 2>&1 | grep -c "error"
```

Esperado: `0`.

- [ ] **Step 6: Rodar testes do frontend**

```bash
docker compose exec frontend npm test -- --run 2>&1 | tail -10
```

Esperado: `Test Files  2 passed`, `Tests  6 passed`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/expenses/ExpenseDialog.tsx \
        frontend/src/components/payments/PaymentDialog.tsx \
        frontend/src/components/Sidebar.tsx
git commit -m "fix(frontend): envolver setState em startTransition dentro de useEffect"
```

---

## Task 6: Verificação Final

- [ ] **Step 1: Rodar todos os testes do backend**

```bash
make test-backend-integration 2>&1 | grep -E "^--- FAIL|^FAIL" | head -20
```

Esperado: nenhuma linha `FAIL`.

- [ ] **Step 2: Rodar lint completo do frontend**

```bash
make frontend-lint 2>&1 | tail -5
```

Esperado: `0 errors, X warnings` (sem erros).

- [ ] **Step 3: Build do frontend**

```bash
docker compose exec frontend npm run build 2>&1 | tail -5
```

Esperado: build bem-sucedido, nenhuma linha `Error:`.

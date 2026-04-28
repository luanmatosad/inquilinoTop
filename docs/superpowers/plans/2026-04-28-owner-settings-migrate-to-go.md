# Owner Settings — Migração para Go: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover toda dependência Supabase dos DALs em `src/data/owner/` e de `src/app/owner/contracts/new/actions.ts`, migrar para Go API, e adicionar o endpoint Go para preferências de notificação do proprietário no módulo `identity`.

**Architecture:** Backend primeiro — nova tabela `user_notification_preferences` no módulo `identity` com upsert pattern idêntico ao `user_profiles`. Frontend segundo — 4 DALs e 1 arquivo de actions substituídos por `goFetch`, sem alterar páginas ou componentes.

**Tech Stack:** Go 1.25, pgx v5, golang-migrate, chi v5, Next.js 16 App Router, `goFetch` de `@/lib/go/server-auth`

---

## File Map

**Create:**
- `backend/migrations/000030_create_user_notification_preferences.up.sql`
- `backend/migrations/000030_create_user_notification_preferences.down.sql`
- `backend/internal/identity/handler_preferences.go`
- `backend/internal/identity/repository_preferences_test.go`
- `backend/internal/identity/service_preferences_test.go`

**Modify:**
- `backend/internal/identity/model.go` — add `NotificationPreferences`, `UpsertNotificationPreferencesInput`, extend `Repository` interface
- `backend/internal/identity/repository.go` — implement `GetNotificationPreferences`, `UpsertNotificationPreferences`
- `backend/internal/identity/service.go` — add `GetNotificationPreferences`, `UpdateNotificationPreferences`
- `backend/internal/identity/handler.go` — register 2 new routes in `RegisterProtected`
- `frontend/src/data/owner/preferences-dal.ts` — substituir Supabase por goFetch
- `frontend/src/data/owner/properties-dal.ts` — substituir Supabase por goFetch, remover `createOwnerClient`
- `frontend/src/data/owner/tenants-dal.ts` — substituir Supabase por goFetch, adicionar `person_type`
- `frontend/src/data/owner/contracts-dal.ts` — substituir Supabase por goFetch, `getActiveLeaseForUnit` via filter
- `frontend/src/app/owner/contracts/new/actions.ts` — substituir Supabase por goFetch

---

## Task 1: Migration — Tabela `user_notification_preferences`

**Files:**
- Create: `backend/migrations/000030_create_user_notification_preferences.up.sql`
- Create: `backend/migrations/000030_create_user_notification_preferences.down.sql`

- [ ] **Step 1: Criar migration UP**

Conteúdo de `backend/migrations/000030_create_user_notification_preferences.up.sql`:

```sql
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notify_payment_overdue BOOLEAN NOT NULL DEFAULT true,
    notify_lease_expiring BOOLEAN NOT NULL DEFAULT true,
    notify_lease_expiring_days INTEGER NOT NULL DEFAULT 30,
    notify_new_message BOOLEAN NOT NULL DEFAULT true,
    notify_maintenance_request BOOLEAN NOT NULL DEFAULT true,
    notify_payment_received BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Criar migration DOWN**

Conteúdo de `backend/migrations/000030_create_user_notification_preferences.down.sql`:

```sql
DROP TABLE IF EXISTS user_notification_preferences;
```

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/000030_create_user_notification_preferences.up.sql \
        backend/migrations/000030_create_user_notification_preferences.down.sql
git commit -m "feat(identity): add user_notification_preferences migration"
```

---

## Task 2: Model — Tipos e Interface Repository

**Files:**
- Modify: `backend/internal/identity/model.go`

- [ ] **Step 1: Adicionar tipos ao final do arquivo `model.go`**

Logo antes da definição de `TwoFactorSetup`, adicionar:

```go
type NotificationPreferences struct {
	UserID                   uuid.UUID `json:"user_id"`
	NotifyPaymentOverdue     bool      `json:"notify_payment_overdue"`
	NotifyLeaseExpiring      bool      `json:"notify_lease_expiring"`
	NotifyLeaseExpiringDays  int       `json:"notify_lease_expiring_days"`
	NotifyNewMessage         bool      `json:"notify_new_message"`
	NotifyMaintenanceRequest bool      `json:"notify_maintenance_request"`
	NotifyPaymentReceived    bool      `json:"notify_payment_received"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

type UpsertNotificationPreferencesInput struct {
	NotifyPaymentOverdue     bool `json:"notify_payment_overdue"`
	NotifyLeaseExpiring      bool `json:"notify_lease_expiring"`
	NotifyLeaseExpiringDays  int  `json:"notify_lease_expiring_days"`
	NotifyNewMessage         bool `json:"notify_new_message"`
	NotifyMaintenanceRequest bool `json:"notify_maintenance_request"`
	NotifyPaymentReceived    bool `json:"notify_payment_received"`
}
```

- [ ] **Step 2: Estender interface `Repository` com os dois novos métodos**

Na interface `Repository`, após `UpsertProfile`, adicionar:

```go
GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error)
UpsertNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error)
```

- [ ] **Step 3: Verificar que o código compila**

```bash
docker compose exec backend go build ./internal/identity/...
```

Esperado: erro de compilação indicando que `pgRepository` não implementa os novos métodos da interface (isso é esperado — a implementação vem na Task 3).

- [ ] **Step 4: Commit**

```bash
git add backend/internal/identity/model.go
git commit -m "feat(identity): add NotificationPreferences types and extend Repository interface"
```

---

## Task 3: Repository — Implementar GetNotificationPreferences e UpsertNotificationPreferences

**Files:**
- Modify: `backend/internal/identity/repository.go`

- [ ] **Step 1: Adicionar os dois métodos ao final de `repository.go`**

```go
func (r *pgRepository) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	var p NotificationPreferences
	err := r.db.Pool.QueryRow(ctx,
		`SELECT user_id, notify_payment_overdue, notify_lease_expiring, notify_lease_expiring_days,
		        notify_new_message, notify_maintenance_request, notify_payment_received, created_at, updated_at
		 FROM user_notification_preferences WHERE user_id = $1`,
		userID,
	).Scan(
		&p.UserID, &p.NotifyPaymentOverdue, &p.NotifyLeaseExpiring, &p.NotifyLeaseExpiringDays,
		&p.NotifyNewMessage, &p.NotifyMaintenanceRequest, &p.NotifyPaymentReceived,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("identity.repo: get notification preferences: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) UpsertNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error) {
	var p NotificationPreferences
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO user_notification_preferences
		 (user_id, notify_payment_overdue, notify_lease_expiring, notify_lease_expiring_days,
		  notify_new_message, notify_maintenance_request, notify_payment_received, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		 	notify_payment_overdue     = EXCLUDED.notify_payment_overdue,
		 	notify_lease_expiring      = EXCLUDED.notify_lease_expiring,
		 	notify_lease_expiring_days = EXCLUDED.notify_lease_expiring_days,
		 	notify_new_message         = EXCLUDED.notify_new_message,
		 	notify_maintenance_request = EXCLUDED.notify_maintenance_request,
		 	notify_payment_received    = EXCLUDED.notify_payment_received,
		 	updated_at                 = NOW()
		 RETURNING user_id, notify_payment_overdue, notify_lease_expiring, notify_lease_expiring_days,
		           notify_new_message, notify_maintenance_request, notify_payment_received, created_at, updated_at`,
		userID, in.NotifyPaymentOverdue, in.NotifyLeaseExpiring, in.NotifyLeaseExpiringDays,
		in.NotifyNewMessage, in.NotifyMaintenanceRequest, in.NotifyPaymentReceived,
	).Scan(
		&p.UserID, &p.NotifyPaymentOverdue, &p.NotifyLeaseExpiring, &p.NotifyLeaseExpiringDays,
		&p.NotifyNewMessage, &p.NotifyMaintenanceRequest, &p.NotifyPaymentReceived,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: upsert notification preferences: %w", err)
	}
	return &p, nil
}
```

- [ ] **Step 2: Verificar que compila sem erros**

```bash
docker compose exec backend go build ./internal/identity/...
```

Esperado: compilação sem erros (a interface agora está totalmente implementada).

- [ ] **Step 3: Commit**

```bash
git add backend/internal/identity/repository.go
git commit -m "feat(identity): implement GetNotificationPreferences and UpsertNotificationPreferences in repository"
```

---

## Task 4: Testes de Integração — Repository

**Files:**
- Create: `backend/internal/identity/repository_preferences_test.go`

- [ ] **Step 1: Criar o arquivo de teste**

```go
package identity_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/internal/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepository_NotificationPreferences(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, err := repo.CreateUser(context.Background(), "notif_prefs@example.com", "hash")
	require.NoError(t, err)

	// Sem preferências inicialmente
	p, err := repo.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Nil(t, p)

	// Upsert cria preferências
	p, err = repo.UpsertNotificationPreferences(context.Background(), user.ID, identity.UpsertNotificationPreferencesInput{
		NotifyPaymentOverdue:     true,
		NotifyLeaseExpiring:      false,
		NotifyLeaseExpiringDays:  15,
		NotifyNewMessage:         true,
		NotifyMaintenanceRequest: false,
		NotifyPaymentReceived:    true,
	})
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, user.ID, p.UserID)
	assert.True(t, p.NotifyPaymentOverdue)
	assert.False(t, p.NotifyLeaseExpiring)
	assert.Equal(t, 15, p.NotifyLeaseExpiringDays)

	// Get retorna o que foi salvo
	p2, err := repo.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	require.NotNil(t, p2)
	assert.Equal(t, 15, p2.NotifyLeaseExpiringDays)

	// Upsert atualiza existente
	p3, err := repo.UpsertNotificationPreferences(context.Background(), user.ID, identity.UpsertNotificationPreferencesInput{
		NotifyPaymentOverdue:     false,
		NotifyLeaseExpiring:      true,
		NotifyLeaseExpiringDays:  30,
		NotifyNewMessage:         false,
		NotifyMaintenanceRequest: true,
		NotifyPaymentReceived:    false,
	})
	require.NoError(t, err)
	assert.False(t, p3.NotifyPaymentOverdue)
	assert.True(t, p3.NotifyLeaseExpiring)
	assert.Equal(t, 30, p3.NotifyLeaseExpiringDays)
}
```

- [ ] **Step 2: Rodar os testes de integração**

```bash
make test-backend-integration
```

Esperado: `TestRepository_NotificationPreferences` PASS (a migration 000030 roda automaticamente via `db.RunMigrations`).

- [ ] **Step 3: Commit**

```bash
git add backend/internal/identity/repository_preferences_test.go
git commit -m "test(identity): add integration tests for notification preferences repository"
```

---

## Task 5: Service — GetNotificationPreferences e UpdateNotificationPreferences

**Files:**
- Modify: `backend/internal/identity/service.go`

- [ ] **Step 1: Adicionar os dois métodos ao `service.go`**

Ao final do arquivo, após `UpdateProfile`:

```go
func (s *Service) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	return s.repo.GetNotificationPreferences(ctx, userID)
}

func (s *Service) UpdateNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error) {
	return s.repo.UpsertNotificationPreferences(ctx, userID, in)
}
```

- [ ] **Step 2: Criar o arquivo de teste do service**

Criar `backend/internal/identity/service_preferences_test.go`:

```go
package identity_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestService_NotificationPreferences(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	privateKey, err := auth.LoadPrivateKey("../../keys/private.pem")
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privateKey)

	svc := identity.NewService(repo, jwtSvc)

	user, err := repo.CreateUser(context.Background(), "svc_notif@example.com", "hash")
	require.NoError(t, err)

	// Get quando não existe retorna nil
	p, err := svc.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Nil(t, p)

	// Update cria e retorna preferências
	p2, err := svc.UpdateNotificationPreferences(context.Background(), user.ID, identity.UpsertNotificationPreferencesInput{
		NotifyPaymentOverdue:    true,
		NotifyLeaseExpiring:     true,
		NotifyLeaseExpiringDays: 30,
	})
	require.NoError(t, err)
	require.NotNil(t, p2)
	assert.Equal(t, user.ID, p2.UserID)
	assert.Equal(t, 30, p2.NotifyLeaseExpiringDays)

	// Get agora retorna
	p3, err := svc.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	require.NotNil(t, p3)
	assert.True(t, p3.NotifyPaymentOverdue)
}
```

- [ ] **Step 3: Rodar os testes**

```bash
make test-backend-integration
```

Esperado: `TestService_NotificationPreferences` PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/identity/service.go \
        backend/internal/identity/service_preferences_test.go
git commit -m "feat(identity): add GetNotificationPreferences and UpdateNotificationPreferences to service"
```

---

## Task 6: Handler — getNotificationPreferences e updateNotificationPreferences

**Files:**
- Create: `backend/internal/identity/handler_preferences.go`
- Modify: `backend/internal/identity/handler.go`

- [ ] **Step 1: Criar `handler_preferences.go`**

```go
package identity

import (
	"encoding/json"
	"net/http"

	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

// @Summary     Buscar preferências de notificação
// @Tags        identity
// @Security    BearerAuth
// @Produce     json
// @Success     200  {object}  map[string]interface{}
// @Failure     500  {object}  map[string]interface{}
// @Router      /auth/notification-preferences [get]
func (h *Handler) getNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	prefs, err := h.svc.GetNotificationPreferences(r.Context(), userID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao buscar preferências")
		return
	}
	if prefs == nil {
		prefs = &NotificationPreferences{
			UserID:                   userID,
			NotifyPaymentOverdue:     true,
			NotifyLeaseExpiring:      true,
			NotifyLeaseExpiringDays:  30,
			NotifyNewMessage:         true,
			NotifyMaintenanceRequest: true,
			NotifyPaymentReceived:    true,
		}
	}
	httputil.OK(w, prefs)
}

// @Summary     Atualizar preferências de notificação
// @Tags        identity
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body body UpsertNotificationPreferencesInput true "Preferências"
// @Success     200  {object}  map[string]interface{}
// @Failure     400  {object}  map[string]interface{}
// @Failure     500  {object}  map[string]interface{}
// @Router      /auth/notification-preferences [put]
func (h *Handler) updateNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())

	var in UpsertNotificationPreferencesInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_PAYLOAD", "Payload inválido")
		return
	}

	prefs, err := h.svc.UpdateNotificationPreferences(r.Context(), userID, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao atualizar preferências")
		return
	}
	httputil.OK(w, prefs)
}
```

- [ ] **Step 2: Registrar as rotas em `handler.go`**

Em `RegisterProtected`, após as rotas de profile, adicionar:

```go
r.With(authMW).Get("/auth/notification-preferences", h.getNotificationPreferences)
r.With(authMW).Put("/auth/notification-preferences", h.updateNotificationPreferences)
```

- [ ] **Step 3: Compilar e verificar**

```bash
docker compose exec backend go build ./...
```

Esperado: compilação sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/identity/handler_preferences.go \
        backend/internal/identity/handler.go
git commit -m "feat(identity): add notification preferences handler and routes"
```

---

## Task 7: Frontend — preferences-dal.ts

**Files:**
- Modify: `frontend/src/data/owner/preferences-dal.ts`

- [ ] **Step 1: Substituir conteúdo completo do arquivo**

```ts
import { goFetch } from '@/lib/go/server-auth'

export interface OwnerSettings {
  user_id: string
  notify_payment_overdue: boolean
  notify_lease_expiring: boolean
  notify_lease_expiring_days: number
  notify_new_message: boolean
  notify_maintenance_request: boolean
  notify_payment_received: boolean
  created_at: string
  updated_at: string
}

export interface UpdateOwnerSettingsInput {
  notify_payment_overdue?: boolean
  notify_lease_expiring?: boolean
  notify_lease_expiring_days?: number
  notify_new_message?: boolean
  notify_maintenance_request?: boolean
  notify_payment_received?: boolean
}

export async function getOwnerSettings(): Promise<OwnerSettings | null> {
  try {
    return await goFetch<OwnerSettings>('/api/v1/auth/notification-preferences')
  } catch {
    return null
  }
}

export async function upsertOwnerSettings(input: UpdateOwnerSettingsInput): Promise<OwnerSettings> {
  return goFetch<OwnerSettings>('/api/v1/auth/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
```

- [ ] **Step 2: Verificar que não há imports de Supabase**

```bash
grep -n "supabase\|@supabase" frontend/src/data/owner/preferences-dal.ts
```

Esperado: sem output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/owner/preferences-dal.ts
git commit -m "feat(frontend): migrate preferences-dal from Supabase to Go API"
```

---

## Task 8: Frontend — properties-dal.ts

**Files:**
- Modify: `frontend/src/data/owner/properties-dal.ts`

- [ ] **Step 1: Substituir conteúdo completo do arquivo**

```ts
import { goFetch } from '@/lib/go/server-auth'

export interface Property {
  id: string
  owner_id: string
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line: string | null
  city: string | null
  state: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PropertyWithUnits extends Property {
  units: { id: string }[]
}

export async function listProperties(): Promise<PropertyWithUnits[]> {
  try {
    const data = await goFetch<PropertyWithUnits[]>('/api/v1/properties')
    return data ?? []
  } catch {
    return []
  }
}

export async function getProperty(id: string): Promise<Property | null> {
  try {
    return await goFetch<Property>(`/api/v1/properties/${id}`)
  } catch {
    return null
  }
}

export interface CreatePropertyInput {
  type: 'RESIDENTIAL' | 'SINGLE'
  name: string
  address_line?: string
  city?: string
  state?: string
}

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  return goFetch<Property>('/api/v1/properties', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdatePropertyInput {
  name?: string
  address_line?: string
  city?: string
  state?: string
  is_active?: boolean
}

export async function updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
  return goFetch<Property>(`/api/v1/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
```

Nota: `type` foi removido de `UpdatePropertyInput` porque o Go não permite alterar o tipo após a criação.

- [ ] **Step 2: Verificar ausência de Supabase**

```bash
grep -n "supabase\|@supabase\|createOwnerClient" frontend/src/data/owner/properties-dal.ts
```

Esperado: sem output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/owner/properties-dal.ts
git commit -m "feat(frontend): migrate properties-dal from Supabase to Go API"
```

---

## Task 9: Frontend — tenants-dal.ts

**Files:**
- Modify: `frontend/src/data/owner/tenants-dal.ts`

- [ ] **Step 1: Substituir conteúdo completo do arquivo**

```ts
import { goFetch } from '@/lib/go/server-auth'

export interface Tenant {
  id: string
  owner_id: string
  name: string
  email: string | null
  phone: string | null
  document: string | null
  person_type: 'PF' | 'PJ'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TenantWithLeases extends Tenant {
  leases: {
    id: string
    unit_id: string
    start_date: string
    end_date: string | null
    status: string
    rent_amount: number
    payment_day: number
  }[]
}

export async function listTenants(): Promise<Tenant[]> {
  try {
    const data = await goFetch<Tenant[]>('/api/v1/tenants')
    return data ?? []
  } catch {
    return []
  }
}

export async function getTenant(id: string): Promise<Tenant | null> {
  try {
    return await goFetch<Tenant>(`/api/v1/tenants/${id}`)
  } catch {
    return null
  }
}

export interface CreateTenantInput {
  name: string
  person_type: 'PF' | 'PJ'
  email?: string
  phone?: string
  document?: string
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  return goFetch<Tenant>('/api/v1/tenants', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdateTenantInput {
  name?: string
  person_type?: 'PF' | 'PJ'
  email?: string
  phone?: string
  document?: string
  is_active?: boolean
}

export async function updateTenant(id: string, input: UpdateTenantInput): Promise<Tenant> {
  return goFetch<Tenant>(`/api/v1/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function getTenantWithLeases(id: string): Promise<TenantWithLeases | null> {
  try {
    return await goFetch<TenantWithLeases>(`/api/v1/tenants/${id}`)
  } catch {
    return null
  }
}
```

Nota: `person_type` é agora obrigatório em `CreateTenantInput` (o Go exige). Se algum formulário existente não envia esse campo, precisará ser atualizado para incluir um valor padrão (`'PF'`).

- [ ] **Step 2: Verificar ausência de Supabase**

```bash
grep -n "supabase\|@supabase\|createOwnerClient" frontend/src/data/owner/tenants-dal.ts
```

Esperado: sem output.

- [ ] **Step 3: Verificar se algum form de criação de tenant precisa de `person_type`**

```bash
grep -rn "createTenant\|CreateTenantInput" frontend/src/ --include="*.ts" --include="*.tsx"
```

Se algum caller não passa `person_type`, atualizar para incluir `person_type: 'PF'` como default ou adicionar campo no formulário.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/owner/tenants-dal.ts
git commit -m "feat(frontend): migrate tenants-dal from Supabase to Go API"
```

---

## Task 10: Frontend — contracts-dal.ts

**Files:**
- Modify: `frontend/src/data/owner/contracts-dal.ts`

- [ ] **Step 1: Substituir conteúdo completo do arquivo**

```ts
import { goFetch } from '@/lib/go/server-auth'

export interface Lease {
  id: string
  owner_id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date: string | null
  rent_amount: number
  payment_day: number
  status: 'ACTIVE' | 'ENDED' | 'CANCELED'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LeaseWithDetails extends Lease {
  units: { id: string; property_id: string; label: string } | null
  tenants: { id: string; name: string } | null
}

export async function listLeases(): Promise<LeaseWithDetails[]> {
  try {
    const data = await goFetch<Lease[]>('/api/v1/leases')
    return (data ?? []) as LeaseWithDetails[]
  } catch {
    return []
  }
}

export async function getLease(id: string): Promise<Lease | null> {
  try {
    return await goFetch<Lease>(`/api/v1/leases/${id}`)
  } catch {
    return null
  }
}

export interface CreateLeaseInput {
  unit_id: string
  tenant_id: string
  start_date: string
  end_date?: string
  rent_amount: number
  payment_day: number
  notes?: string
}

export async function createLease(input: CreateLeaseInput): Promise<Lease> {
  return goFetch<Lease>('/api/v1/leases', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface UpdateLeaseInput {
  start_date?: string
  end_date?: string
  rent_amount?: number
  payment_day?: number
  status?: 'ACTIVE' | 'ENDED' | 'CANCELED'
  notes?: string
}

export async function updateLease(id: string, input: UpdateLeaseInput): Promise<Lease> {
  return goFetch<Lease>(`/api/v1/leases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function endLease(id: string): Promise<Lease> {
  return goFetch<Lease>(`/api/v1/leases/${id}/end`, { method: 'POST' })
}

export async function getActiveLeaseForUnit(unitId: string): Promise<Lease | null> {
  try {
    const leases = await goFetch<Lease[]>('/api/v1/leases')
    return (leases ?? []).find(l => l.unit_id === unitId && l.status === 'ACTIVE') ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Verificar ausência de Supabase**

```bash
grep -n "supabase\|@supabase\|createOwnerClient" frontend/src/data/owner/contracts-dal.ts
```

Esperado: sem output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/data/owner/contracts-dal.ts
git commit -m "feat(frontend): migrate contracts-dal from Supabase to Go API"
```

---

## Task 11: Frontend — contracts/new/actions.ts

**Files:**
- Modify: `frontend/src/app/owner/contracts/new/actions.ts`

- [ ] **Step 1: Substituir conteúdo completo do arquivo**

```ts
"use server"

import { goFetch } from '@/lib/go/server-auth'
import { createLease, getActiveLeaseForUnit } from "@/data/owner/contracts-dal"
import { redirect } from "next/navigation"

interface Unit {
  id: string
  label: string
  property_id: string
}

interface Property {
  id: string
  units: Unit[]
}

interface Tenant {
  id: string
  name: string
}

export async function getUnitsForForm(): Promise<Unit[]> {
  try {
    const properties = await goFetch<Property[]>('/api/v1/properties')
    return (properties ?? []).flatMap(p =>
      (p.units ?? []).map(u => ({ ...u, property_id: p.id }))
    )
  } catch {
    return []
  }
}

export async function getTenantsForForm(): Promise<Tenant[]> {
  try {
    const tenants = await goFetch<Tenant[]>('/api/v1/tenants')
    return tenants ?? []
  } catch {
    return []
  }
}

interface FormState {
  errors?: Record<string, string[]>
}

export async function createLeaseAction(formData: FormData): Promise<FormState> {
  const unit_id = formData.get("unit_id") as string
  const tenant_id = formData.get("tenant_id") as string
  const start_date = formData.get("start_date") as string
  const end_date = formData.get("end_date") as string
  const rent_amount = formData.get("rent_amount") as string
  const payment_day = formData.get("payment_day") as string
  const notes = formData.get("notes") as string

  const errors: Record<string, string[]> = {}

  if (!unit_id) errors.unit_id = ["Unidade é obrigatória"]
  if (!tenant_id) errors.tenant_id = ["Inquilino é obrigatório"]
  if (!start_date) errors.start_date = ["Data de início é obrigatória"]
  if (!rent_amount) errors.rent_amount = ["Valor do aluguel é obrigatório"]
  if (!payment_day) errors.payment_day = ["Dia de pagamento é obrigatório"]

  if (Object.keys(errors).length > 0) {
    return { errors }
  }

  try {
    const existingLease = await getActiveLeaseForUnit(unit_id)
    if (existingLease) {
      return { errors: { unit_id: ["Esta unidade já possui um contrato ativo"] } }
    }

    await createLease({
      unit_id,
      tenant_id,
      start_date,
      end_date: end_date || undefined,
      rent_amount: Number(rent_amount),
      payment_day: Number(payment_day),
      notes: notes || undefined,
    })
  } catch (error) {
    console.error("Error creating lease:", error)
    return { errors: { _form: ["Erro ao criar contrato. Tente novamente."] } }
  }

  redirect("/owner/contracts")
}
```

- [ ] **Step 2: Verificar ausência de Supabase**

```bash
grep -n "supabase\|@supabase\|createOwnerClient" frontend/src/app/owner/contracts/new/actions.ts
```

Esperado: sem output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/owner/contracts/new/actions.ts
git commit -m "feat(frontend): migrate contract new actions from Supabase to Go API"
```

---

## Task 12: Verificação Final — Nenhum Supabase em owner/

**Files:** Leitura apenas

- [ ] **Step 1: Varrer todos os arquivos owner por imports Supabase**

```bash
grep -rn "supabase\|@supabase\|createOwnerClient" \
  frontend/src/data/owner/ \
  frontend/src/app/owner/ \
  --include="*.ts" --include="*.tsx"
```

Esperado: **sem output**. Se houver output, corrigir o arquivo correspondente antes de continuar.

- [ ] **Step 2: Verificar build TypeScript do frontend**

```bash
docker compose exec frontend npm run build 2>&1 | tail -20
```

Esperado: build sem erros de tipo. Erros de `person_type` ausente ou campo incompatível indicam que algum formulário precisa ser atualizado (ver nota na Task 9).

- [ ] **Step 3: Rodar todos os testes backend**

```bash
make test-backend-integration
```

Esperado: todos os testes PASS, incluindo os novos `TestRepository_NotificationPreferences` e `TestService_NotificationPreferences`.

- [ ] **Step 4: Commit final (se houver correções menores)**

```bash
git add -p
git commit -m "fix(frontend): adjust owner pages after Supabase removal"
```

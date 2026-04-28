# Design: Migração Owner Settings para Go

**Data:** 2026-04-28  
**Status:** Aprovado

## Contexto

O módulo de configurações do proprietário (`owner/settings`) e as páginas `owner/properties`, `owner/tenants` e `owner/contracts` foram construídas com DALs que acessam o Supabase diretamente. O backend Go já possui os módulos `property`, `tenant` e `lease` com CRUD completo. Falta apenas o backend para preferências de notificação do proprietário.

## Objetivo

Remover todas as dependências Supabase dos DALs em `src/data/owner/` e migrar para chamadas Go API. Nenhuma lógica Supabase deve permanecer nesses arquivos após a migração.

## Escopo

### Fora do escopo
- Alterações nas páginas e formulários (`owner/*/page.tsx`, componentes)
- Migração de outros módulos (dashboard, financial, etc.)
- Modificações nos endpoints Go existentes de property, tenant e lease

---

## 1. Backend — Módulo `identity`: Preferências de Notificação

### Migration

Nova migration `000030_create_user_notification_preferences`:

```sql
-- UP
CREATE TABLE user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notify_payment_overdue BOOLEAN NOT NULL DEFAULT true,
    notify_lease_expiring BOOLEAN NOT NULL DEFAULT true,
    notify_lease_expiring_days INTEGER NOT NULL DEFAULT 30,
    notify_new_message BOOLEAN NOT NULL DEFAULT true,
    notify_maintenance_request BOOLEAN NOT NULL DEFAULT true,
    notify_payment_received BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_notification_preferences UNIQUE (user_id)
);

-- DOWN
DROP TABLE IF EXISTS user_notification_preferences;
```

### Modelos (`identity/model.go`)

Novos tipos adicionados ao arquivo existente:

```go
type NotificationPreferences struct {
    ID                       uuid.UUID `json:"id"`
    UserID                   uuid.UUID `json:"user_id"`
    NotifyPaymentOverdue     bool      `json:"notify_payment_overdue"`
    NotifyLeaseExpiring      bool      `json:"notify_lease_expiring"`
    NotifyLeaseExpiringDays  int       `json:"notify_lease_expiring_days"`
    NotifyNewMessage         bool      `json:"notify_new_message"`
    NotifyMaintenanceRequest bool      `json:"notify_maintenance_request"`
    NotifyPaymentReceived    bool      `json:"notify_payment_received"`
    CreatedAt                string    `json:"created_at"`
    UpdatedAt                string    `json:"updated_at"`
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

Interface `Repository` estendida com:
```go
GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error)
UpsertNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error)
```

### Repositório (`identity/repository.go`)

- `GetNotificationPreferences`: SELECT por `user_id`. Retorna `apierr.ErrNotFound` se nenhuma linha existir.
- `UpsertNotificationPreferences`: INSERT ... ON CONFLICT (user_id) DO UPDATE SET com todos os campos + `updated_at = NOW()`.

### Service (`identity/service.go`)

- `GetNotificationPreferences(ctx, userID)` — delega ao repo.
- `UpdateNotificationPreferences(ctx, userID, in)` — delega ao repo (upsert).

### Handler (`identity/handler_preferences.go`)

Novo arquivo, mesmo padrão do `handler_profile.go`:

- `getNotificationPreferences`: extrai `userID` do JWT, chama service, retorna 200 ou 404.
- `updateNotificationPreferences`: decode body, chama service, retorna 200.

Rotas registradas em `handler.go`:
```
GET  /api/v1/auth/notification-preferences
PUT  /api/v1/auth/notification-preferences
```

Ambas protegidas com `authMW`.

### Testes

- `service_preferences_test.go`: unit tests com mock repo para Get e Upsert.
- `repository_preferences_test.go`: integration tests contra DB real via `testDB()`.

---

## 2. Frontend — Substituição dos DALs Supabase

### `src/data/owner/properties-dal.ts`

Remove `createOwnerClient()` (criação de cliente Supabase) e todas as chamadas `supabase.from(...)`.  
Substitui por `goFetch` do `@/lib/go/server-auth`:

```ts
import { goFetch } from '@/lib/go/server-auth'

export async function listProperties(): Promise<PropertyWithUnits[]> {
  const data = await goFetch<PropertyWithUnits[]>('/api/v1/properties')
  return data ?? []
}

export async function getProperty(id: string): Promise<Property | null> {
  try {
    return await goFetch<Property>(`/api/v1/properties/${id}`)
  } catch { return null }
}

export async function createProperty(input: CreatePropertyInput): Promise<Property> {
  return goFetch<Property>('/api/v1/properties', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
  return goFetch<Property>(`/api/v1/properties/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
```

### `src/data/owner/tenants-dal.ts`

Remove importação de `createOwnerClient`. Todas as funções substituídas por `goFetch('/api/v1/tenants', ...)`.

Atenção: o modelo Go exige `person_type: 'PF' | 'PJ'` obrigatório em create/update. A interface `CreateTenantInput` deve incluir esse campo.

### `src/data/owner/contracts-dal.ts`

Remove Supabase. Todas as funções substituídas por `goFetch('/api/v1/leases', ...)`.

Mapeamento de endpoints:
- `listLeases()` → `GET /api/v1/leases`
- `getLease(id)` → `GET /api/v1/leases/{id}`
- `createLease(input)` → `POST /api/v1/leases`
- `updateLease(id, input)` → `PUT /api/v1/leases/{id}`
- `endLease(id)` → `POST /api/v1/leases/{id}/end`
- `getActiveLeaseForUnit(unitId)` → implementada via `GET /api/v1/leases` + filtro no cliente (`unit_id === unitId && status === 'ACTIVE'`). Não há endpoint dedicado no Go, mas a listagem já retorna todos os contratos do owner.

### `src/data/owner/preferences-dal.ts`

Remove Supabase `owner_settings`. Substitui por:

```ts
import { goFetch } from '@/lib/go/server-auth'

export async function getOwnerSettings(): Promise<OwnerSettings | null> {
  try {
    return await goFetch<OwnerSettings>('/api/v1/auth/notification-preferences')
  } catch { return null }
}

export async function upsertOwnerSettings(input: UpdateOwnerSettingsInput): Promise<OwnerSettings> {
  return goFetch<OwnerSettings>('/api/v1/auth/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
```

### `src/app/owner/settings/actions.ts`

Sem mudanças estruturais — já chama `getOwnerSettings`/`upsertOwnerSettings` do DAL. Funciona automaticamente após a troca do DAL.

### `src/app/owner/contracts/new/actions.ts`

Também usa Supabase diretamente para popular o formulário de novo contrato:

- `getUnitsForForm()` → substituir por `goFetch<Unit[]>('/api/v1/properties')` + expandir units via `GET /api/v1/properties/{id}/units` por property, ou chamar `goFetch` para cada property. Alternativa mais simples: o Go retorna `units` embutidas na listagem de properties — usar esse dado já disponível.
- `getTenantsForForm()` → substituir por `goFetch<Tenant[]>('/api/v1/tenants')`.
- Remove `createOwnerClient` importado de `properties-dal`.

---

## 3. Limpeza

- Remover `createOwnerClient()` de `properties-dal.ts` (era o único lugar onde era definida).
- Remover importação de `createOwnerClient` em `contracts/new/actions.ts`.
- Garantir que nenhum arquivo em `src/data/owner/` ou `src/app/owner/` importe de `@supabase/ssr` ou `@supabase/supabase-js`.

---

## Ordem de Implementação

1. Migration + backend `identity` (preferências)
2. Testes backend
3. DAL `preferences-dal.ts`
4. DAL `properties-dal.ts`
5. DAL `tenants-dal.ts`
6. DAL `contracts-dal.ts`
7. Verificar types e remover `createOwnerClient`

## Context

O backend Go já está completo com todas as APIs (identity, property, tenant, lease, payment, expense, fiscal). O frontend ainda usa Supabase para:

1. **Auth**: `src/app/auth/actions.ts`, `src/middleware.ts`, `src/lib/supabase/*`
2. **Pages**: `properties/page.tsx`, `properties/[id]/page.tsx` chamam Supabase diretamente
3. **Actions**: `properties/actions.ts` chama Supabase
4. **Dashboard**: `data/dashboard/dal.ts` chama Supabase

O Go usa JWT RS256, 15 min access token, 30 dias refresh token. Senha com bcrypt.

## Goals / Non-Goals

**Goals:**
- Migrar auth completo do Supabase para Go
- Migrar property/tenant/lease/payment/expense do Supabase para Go
- Remover dependência do Supabase gradualmente

**Non-Goals:**
- Não migrar dados de usuários existentes (recadastramento)
- Não manter compatibilidade com Supabase após migrate completo

## Decisions

### 1. Go Client Library

**Decisão**: Criar `src/lib/go/` para abstracted HTTP

**Alternativas consideredadas**:
- chamar fetch diretamente em cada action — **rejeitado** (duplicação)
- usar SDK externo — **rejeitado** (overhead desnecessário)

**Implementação**:
```typescript
// src/lib/go/client.ts
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function goFetch<T>(path: string, options: RequestInit) {
  const cookie = cookies()
  const token = cookie.get('access_token')
  
  const res = await fetch(`${baseURL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token.value}` }),
      ...options.headers,
    },
  })
  
  // refresh token se 401
  if (res.status === 401) {
    const newToken = await refreshToken()
    // retry com novo token
  }
  
  return res.json()
}
```

### 2. Session Storage

**Decisão**: Usar cookies HTTP-only para access_token e refresh_token

**Alternativas consideredadas**:
- localStorage — **rejeitado** (XSS vulnerable)
- sessionStorage — **rejeitado** (não persiste entre tabs)

### 3. Migration Order

**Decisão**: Auth primeiro → Property → Tenant → Lease → Payment → Expense → Dashboard

**Rationale**: Auth é pré-requisito para todas as outras rotas. Property é a página inicial.

## Risks / Trade-offs

| Risk | Mitigation |
|-----|------------|
| Usuários existentes perdem acesso | Recadastramento (aceito) |
| JWT expira durante uso | Auto-refresh com refresh_token |
| Go API fora do ar | Fallback para mensagem de erro clara |
| CORS em desenvolvimento | Configurar CORS no Go |

## Migration Plan

```
Fase 1: Camada Go Client
├── src/lib/go/client.ts      (fetch + JWT + cookies)
├── src/lib/go/middleware.ts  (validate JWT)
└── .env                      (NEXT_PUBLIC_API_URL)

Fase 2: Auth
├── src/app/auth/actions.ts    (login, signup, logout)
└── src/middleware.ts         (proteção rotas)

Fase 3: Property
├── src/app/properties/actions.ts
├── src/app/properties/page.tsx
├── src/app/properties/[id]/page.tsx
└── src/data/dashboard/dal.ts (parte property)

Fase 4: Tenant → Lease → Payment → Expense (repetir padrão F3)

Fase 5: Limpeza
└── src/lib/supabase/*        (remover quando tudo Go)
```

## Open Questions

- **URL da API em produção**: Qual domínio? Configurar variáveis de produção?
- **Logs de erro**: Precisa agregar logs do frontend para debug?
---
paths:
  - "frontend/**/*.{ts,tsx}"
---

# Frontend — Next.js 15 + Migração Supabase → Go

## Arquitetura Atual

**Next.js 15 App Router** com Supabase como backend provisório. O Go backend é o destino — não criar nova lógica Supabase em domínios já implementados no Go.

## Regra de Migração

Antes de implementar qualquer feature no frontend:

1. Verificar se o domínio já existe no Go backend (`backend/internal/<domínio>/`)
2. **Se existir**: usar o Go API — não criar lógica Supabase nova
3. **Se não existir**: usar Supabase temporariamente e marcar com comentário `// TODO: migrar para Go API`

## Data Flow — Server Actions (Supabase legado)

```ts
// src/app/<módulo>/actions.ts
"use server"

// 1. Validar com Zod
const parsed = schema.safeParse(formData)
if (!parsed.success) return { error: parsed.error }

// 2. Chamar Supabase
const { data, error } = await supabase.from("tabela").insert(parsed.data)

// 3. Revalidar cache
revalidatePath("/rota")
```

## Data Flow — Go API (domínios migrados)

```ts
// src/app/<módulo>/actions.ts
"use server"

const parsed = schema.safeParse(formData)
if (!parsed.success) return { error: parsed.error }

const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/recurso`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
})

revalidatePath("/rota")
```

## Clientes Supabase

| Contexto | Cliente |
|---|---|
| Server Components / Actions | `src/lib/supabase/server.ts` |
| Client Components | `src/lib/supabase/client.ts` |
| Middleware | `src/lib/supabase/middleware.ts` |

Nunca importar o cliente errado para o contexto.

## Validação com Zod

Schemas em `src/lib/schemas.ts`. Toda Server Action DEVE validar input antes de qualquer operação.

## Componentes

- **UI base**: Shadcn/UI em `src/components/ui/` — não modificar, apenas usar
- **Features**: `src/components/<módulo>/` — forms, lists, dialogs
- **Forms**: `react-hook-form` + Zod resolver → chama Server Action diretamente

## Auth

Middleware em `src/middleware.ts` protege todas as rotas exceto `/`, `/login`, `/auth/callback`. Usuário autenticado em `/login` redireciona para `/`.

## Comandos

```bash
npm run dev    # Dev server em http://localhost:3000
npm run build  # Build de produção
npm run lint   # ESLint
```

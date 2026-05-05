# GlitchTip Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing_plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar GlitchTip (open-source Sentry alternative) para capturar erros, pánics e traces no backend Go e frontend Next.js.

**Architecture:** GlitchTip container Docker conecta no PostgreSQL existente; Backend Go e Frontend Next.js usam SDK Sentry com endpoint customizado apontando para GlitchTip.

**Tech Stack:** GlitchTip (Docker), @sentry/go (backend), @sentry/nextjs (frontend), PostgreSQL

---

## Task 1: Adicionar GlitchTip ao docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Adicionar GlitchTip service**

```yaml
  glitchtip:
    image: glitchtip/glitchtip
    ports:
      - "${GLITCHTIP_PORT:-3000}:3000"
    environment:
      - DATABASE_URL=postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${POSTGRES_DB:-inquilinotop}?sslmode=disable
      - GLITCHTIP_SECRET_KEY=${GLITCHTIP_SECRET_KEY:-change-me-in-production}
      - GLITCHTIP_EMAIL_BACKEND=console
      - GLITCHTIP_EMAIL_HOST=mailpit
      - GLITCHTIP_EMAIL_PORT=1025
    depends_on:
      - postgres
    networks:
      - default
```

- [ ] **Step 2: Adicionar variável GLITCHTIP_PORT ao .env.example se não existir**

Verificar se `.env.example` existe e está em `.gitignore`.

---

## Task 2: Configurar Backend Go com DSN customizado

**Files:**
- Modify: `backend/cmd/api/main.go:58-71` (initSentry)
- Modify: `docker-compose.yml` (add SENTRY_DSN)

- [ ] **Step 1: Atualizar initSentry para usar DSN customizado**

O código já tem initSentry, mas precisa adaptar paraGlitchTip:

```go
func initSentry() {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		slog.Warn("SENTRY_DSN not set, Sentry disabled")
		return
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:     envOr("APP_ENV", "development"),
		Release:         "inquilinotop@1.0.0",
		TracesSampleRate: 0.1,
	})
	if err != nil {
		slog.Error("failed to initialize Sentry", "error", err)
		return
	}

	slog.Info("Sentry initialized", "dsn", dsn)
}
```

- [ ] **Step 2: Adicionar SENTRY_DSN ao docker-compose.yml**

```yaml
SENTRY_DSN: ${SENTRY_DSN:-}
```

- [ ] **Step 3: Adicionar variável ao .env.example**

```
SENTRY_DSN=
```

---

## Task 3: Instalar e configurar Sentry no Frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/sentry.client.config.ts`
- Create: `frontend/sentry.server.config.ts`
- Create: `frontend/sentry.edge.config.ts`
- Modify: `frontend/next.config.ts`

- [ ] **Step 1: Instalar @sentry/nextjs**

```bash
npm install @sentry/nextjs
```

- [ ] **Step 2: Criar sentry.client.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ajuste o sample rate para produção (0.1 = 10%)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Ambiente
  environment: process.env.NEXT_PUBLIC_APP_ENV || "development",

  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Integração com Next.js
  integrations: [
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // Capture Replay para erros
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

- [ ] **Step 3: Criar sentry.server.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
  release: process.env.NEXT_PUBLIC_APP_VERSION,
});
```

- [ ] **Step 4: Criar sentry.edge.config.ts**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
  release: process.env.NEXT_PUBLIC_APP_VERSION,
});
```

- [ ] **Step 5: Atualizar next.config.ts com plugin Sentry**

```typescript
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // suas configurações existentes
};

const sentryConfig = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryConfig);
```

- [ ] **Step 6: Adicionar variáveis ao .env.local do frontend**

```
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_VERSION=1.0.0
SENTRY_ORG=
SENTRY_PROJECT=
```

---

## Task 4: Testar smoke test

**Files:**
- Modify: `docker-compose.yml` (test manual)

- [ ] **Step 1: Subir serviços**

```bash
make up-build
```

- [ ] **Step 2: Acessar GlitchTip e criar organização/projeto**

Acessar http://localhost:3000
Criar organização "InquilinoTop"
Criar projetos: "backend", "frontend"

- [ ] **Step 3: Testar erro no backend**

Criar endpoint de teste temporário ou forçar erro:

```go
r.Get("/debug/sentry-test", func(w http.ResponseWriter, r *http.Request) {
    sentry.CaptureMessage("Test error from backend")
    httputil.OK(w, map[string]string{"status": "test error sent"})
})
```

- [ ] **Step 4: Verificar no GlitchTip**

Acessar UI e verificar se erro apareceu

- [ ] **Step 5: Testar erro no frontend**

Criar página de teste simples com erro JS:

```typescript
// app/test-error/page.tsx
"use client";
throw new Error("Test error from frontend");
```

- [ ] **Step 6: Verificar no GlitchTip**

Confirmar erro do frontend apareceu

---

## Task 5: Limpar código de teste

**Files:**
- Modify: `backend/internal/identity/handler.go` (remo endpoint teste se criado)
- Modify: `frontend/app/test-error/page.tsx` (deletar página teste)

- [ ] **Step 1: Remover endpoints/configs de teste**

Após validar que GlitchTip funciona, remover código de teste.

---

## Execution Checklist

| Task | Status |
|------|--------|
| Task 1: GlitchTip container | - [ ] |
| Task 2: Backend Go | - [ ] |
| Task 3: Frontend Next.js | - [ ] |
| Task 4: Smoke test | - [ ] |
| Task 5: Cleanup | - [ ] |

## Dependencies

- PostgreSQL rodando (fornecido pelo compose existente)
- Acesso interno entre containers (mesma rede)
- Variáveis de ambiente configuradas
# Design: GlitchTip Integration

**Date:** 2026-05-04  
**Status:** Design  
**Author:** OpenCode

## Overview

Integrar GlitchTip (alternativa open-source ao Sentry) para captura de erros, pánics e traces em todo o stack: backend Go e frontend Next.js.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GlitchTip                           │
│                   (glitchtip container)                    │
│                        :3000                                │
└─────────────────────────────────────────────────────────────┘
                              ↑
                Sentry Protocol (HTTP)
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────────┐               ┌───────────────────────┐
│      Backend Go       │               │    Frontend Next.js   │
│   (chi router)      │               │   (Next.js app)      │
│   :8080             │               │   :3000             │
└───────────────────────┘               └───────────────────────┘
        │                                           │
        │            PostgreSQL :5432                │
        │           (shared database)                  │
        └───────────────────────────────────────────┘
```

## Components

### 1. GlitchTip Container

- **Image:** `glitchtip/glitchtip` (última versão)
- **Porta:** 3000 (web UI e API)
- **Database:** PostgreSQL existente (`inquilinotop`)
- **Environment:**Variáveis para conexão no banco

### 2. Backend Go

- **SDK:** `github.com/getsentry/sentry-go` (já adicionado)
- **Protocol:** HTTP com endpoint customizado (`SENTRY_DSN` → GlitchTip)
- **Capture:** Errors, pánics, traces
- **Sample Rate:** 10% traces (`TracesSampleRate: 0.1`)

### 3. Frontend Next.js

- **SDK:** `@sentry/nextjs`
- **Integration:** automática do Sentry com Next.js
- **Capture:** Errors JS, API failures, page loads
- **Config:** `sentry.client.config.ts` / `sentry.server.config.ts`

### 4. Environment Variables

| Variable | Backend | Frontend | Description |
|----------|--------|---------|-------------|
| `SENTRY_DSN` | ✅ | ✅ | GlitchTip DSN URL |
| `NEXT_PUBLIC_SENTRY_DSN` | ❌ | ✅ | Frontend (public) |
| `SENTRY_ENVIRONMENT` | ✅ | ✅ | dev/staging/prod |
| `SENTRY_RELEASE` | ✅ | ✅ | versão app |

## Data Flow

###Errors/Pánics

```
Request → chi handler → panic → sentry.Recoverer → sentry.CaptureException → HTTP POST → GlitchTip
```

### Traces

```
httputil response → sentry.StartSpan → complete → sentry.Finish → GlitchTip
```

### Frontend

```
JS Error → window.onerror → @sentry/nextjs → HTTP → GlitchTip
```

## Integration Points

### Backend Go

1. **Inicialização:** `initSentry()` em `cmd/api/main.go`
2. **DSN:** via `SENTRY_DSN` env var
3. **Endpoint:** `https://glitchtip.internal:3000/1/dsn/{project}/`
4. **Recovery:** `sentry.Recoverer` middleware (já configurado)
5. **Hub:** Captura contexto adicional se necessário

### Frontend Next.js

1. **Instalação:** `npm install @sentry/nextjs`
2. **Config:** `sentry.client.config.ts` + `sentry.edge.config.ts` + `sentry.server.config.ts`
3. **next.config.js:** Integração automática com plugin
4. **DSN:** `NEXT_PUBLIC_SENTRY_DSN` (public)
5. **Release:** via `SENTRY_RELEASE` ou CI/CD

## Database Schema

GlitchTip usa as seguintes tabelas (criadas automaticamente):

```sql
-- gl尾声tip_events (eventos de erro)
-- glitchtip_session (sessões)
-- glitchtip Organization (organizações)
-- glitchtip Project (projetos)
-- auth.User (users do sistema)
```

## Security

### Network

- GlitchTip acessível apenas internamente (`internal: network`)
- Backend e frontend na mesma rede Docker

### DSN

- Backend: `SENTRY_DSN` (privado, não exposto)
- Frontend: `NEXT_PUBLIC_SENTRY_DSN` (público mas aponta para internal)

### Data

- Sem PII por padrão
- возможvel filtering upstream (beforeSend)

## Testing

### Local Development

1. Acessar GlitchTip: `http://localhost:3000`
2. Criar organização e projeto no UI
3. Testar erro intentional no backend
4. Testar erro intentional no frontend
5. Verificar Eventos no GlitchTip

### Environment

- `development`: todos os erros
- `staging`: 10% traces
- `production`: 10% traces, filtered PII

## Implementation Steps

### Step 1: GlitchTip Container

- Adicionar ao docker-compose.yml
- Configurar variáveis ambiente
- Conectar no PostgreSQL existente

### Step 2: Backend Go

- Verificar SDK instalado (já feito)
- Configurar DSN via env var
- Adicionar tracing middleware

### Step 3: Frontend Next.js

- Instalar `@sentry/nextjs
- Criar arquivos de config
- Configurar next.config.js

### Step 4: Test

- smoke test erro
- smoke test trace
- verificar no UI

## Trade-offs

### Pros

- Self-hosted, dados sob controle
- Alternativa open-source ao Sentry cloud
- Interface similar ao Sentry (familiar)
- Suporta Error Tracking + Tracing
- Integração Next.js automática

### Cons

- Manutenção adicional (atualizações)
- Mais um container para executar
- Sem o recurso de release health do Sentry
- Precisa configurar PostgreSQL

## Alternatives Considered

### Opção B: Apenas Backend

- Menos complexidade inicial
- Frontend deixa de fora temporariamente

### Opção C: Sentry Cloud

- Sem infraestrutura própria
- Dados vão para Sentry SaaS
- Custo: plano gratuito limitado

## Recommendation

**Approach A** é recomendada pois:
- Já temos PostgreSQL configurado
- Go SDK já parcialmente integrado
- Cobertura completa (Go + Next.js)
- Dados ficam sob nosso controle
- Interface familiar para equipe
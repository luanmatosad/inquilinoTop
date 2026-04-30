# Design: Ambientes de Staging e Produção com Dokploy + Hostinger

**Data:** 2026-04-30  
**Status:** Aprovado

## Contexto

O InquilinoTop precisa de ambientes de homologação (staging) e produção para viabilizar integrações. A hospedagem será em VPS na Hostinger, gerenciado pelo Dokploy. O banco de dados será PostgreSQL gerenciado externo (Neon ou Hostinger Managed DB).

## Arquitetura

```
GitHub repo
  ├── branch: develop  →  push (testes OK)  →  Dokploy staging
  │                                              ├── backend-staging  (:8080)
  │                                              └── frontend-staging (:3000)
  │
  └── branch: main     →  push (testes OK)  →  Dokploy prod
                                                ├── backend-prod     (:8080)
                                                └── frontend-prod    (:3000)

Banco de dados (externo ao VPS):
  ├── PostgreSQL staging  — banco isolado
  └── PostgreSQL prod     — banco isolado
```

**4 Applications no Dokploy**, todas buildadas a partir dos Dockerfiles de produção existentes:
- `backend/Dockerfile` — multi-stage Go, binário estático
- `frontend/Dockerfile` — multi-stage Next.js standalone

O Dokploy escuta webhooks do GitHub e dispara rebuild + restart após testes passarem no CI.

**Networking:** frontend chama backend pela URL pública (necessário para código client-side no browser). Internamente, o Dokploy cria rede Docker por projeto — `backend-staging` e `frontend-staging` compartilham a mesma rede interna do Dokploy.

## Variáveis de Ambiente

### Backend (staging e prod)

| Variável | Descrição |
|---|---|
| `APP_ENV` | `staging` ou `production` |
| `PORT` | `8080` |
| `DATABASE_URL` | URL completa do PostgreSQL gerenciado |
| `JWT_PRIVATE_KEY` | Conteúdo do `private.pem` (PEM direto ou base64) |
| `JWT_PUBLIC_KEY` | Conteúdo do `public.pem` (PEM direto ou base64) |
| `CORS_ALLOWED_ORIGINS` | URL pública do frontend do mesmo ambiente |
| `LOG_LEVEL` | `debug` (staging) / `info` (prod) |

### Frontend (staging e prod)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública do backend do mesmo ambiente |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_SUPABASE_URL` | Enquanto módulos legados existirem |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enquanto módulos legados existirem |

Todas as variáveis são configuradas no painel do Dokploy — nunca em arquivos commitados.

## CI/CD Flow

```
push → develop ou main
  └── GitHub Actions
        ├── backend-unit (testes unitários Go)
        ├── backend-integration (testes com DB)
        ├── frontend-quality (lint)
        └── deploy (só se todos passarem)
              ├── develop → POST $DOKPLOY_WEBHOOK_STAGING
              └── main    → POST $DOKPLOY_WEBHOOK_PROD
```

Secrets no GitHub:
- `DOKPLOY_WEBHOOK_STAGING` — webhook URL da Application staging no Dokploy
- `DOKPLOY_WEBHOOK_PROD` — webhook URL da Application prod no Dokploy

O deploy nunca acontece diretamente no push — sempre após testes verdes.

## Mudanças no Codebase

### 1. JWT keys via variável de ambiente (`pkg/auth`)

Hoje: `JWT_PRIVATE_KEY_PATH` e `JWT_PUBLIC_KEY_PATH` (leitura de arquivo).  
Novo: suporte a `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY` (conteúdo da chave direto na env).

Lógica: se `JWT_PRIVATE_KEY` estiver definida, usa o conteúdo diretamente; caso contrário, lê o arquivo via `JWT_PRIVATE_KEY_PATH`. Mantém retrocompatibilidade total com dev local.

### 2. `NEXT_PUBLIC_API_URL` injetável no build do frontend

O `frontend/Dockerfile` atual hardcoda `ENV NEXT_PUBLIC_API_URL=http://backend:8080`. Isso precisa ser substituído por `ARG NEXT_PUBLIC_API_URL` passado em build-time pelo Dokploy, para que o valor correto seja embutido no bundle do Next.js.

### 3. Nenhuma mudança no `docker-compose.yml`

O compose existente continua intacto para dev local. Staging e prod são configurados exclusivamente no Dokploy.

## Fora de Escopo

- Configuração de CDN ou load balancer
- SSL/TLS (o Dokploy gerencia via Traefik automaticamente)
- Backups do banco (responsabilidade do provedor managed DB)
- Migração do Supabase (processo separado, em andamento)

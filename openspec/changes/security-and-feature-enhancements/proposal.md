## Why

O sistema InquilinoTop possui uma base sólida em Go com 8 módulos funcionando, porém apresenta deficiências críticas de segurança e funcionalidades comparadas a projetos open source similares (Condo, Rentular). A falta de rate limiting, CORS aberto, e sem sistema de roles expõe o sistema a ataques, enquanto a ausência de notificações, documentos, e indexação automática deixa o produto atrás da concorrência.

## What Changes

### Security Enhancements

- Implementar rate limiting por IP/usuário (100 req/min default)
- Configurar CORS restritivo com lista branca de origins
- Adicionar proteção CSRF via tokens
- Implementar RBAC básico (owner, admin, viewer)
- Adicionar suporte a 2FA/TOTP
- Corrigir filtro ownerID em todas as operações Unit
- Adicionar Row-Level Security no PostgreSQL
- Implementar logging de auditoria para operações sensíveis

### Feature Enhancements

- Sistema de documentos (upload/download PDFs)
- Sistema de notificaçõesautomáticas (email/SMS)
- Rate indexation (reajuste automático de aluguel por índice)
- Lembretes automáticos de vencimento
- Dashboard analítico avançado
- Integração com provedores de pagamento (GoCardless/SEPA)

### Technical Improvements

- Graceful shutdown do servidor
- API versioning (/api/v2/)
- Health checks separados (liveness + readiness)
- Métricas Prometheus

## Capabilities

### New Capabilities

- `api-rate-limiting`: Rate limit por IP e usuário com configuração
- `cors-whitelist`: CORS configurável com origins permitidos
- `csrf-protection`: Proteção CSRF com tokens
- `rbac-system`: Sistema de roles e permissões
- `two-factor-auth`: 2FA TOTP para login
- `audit-logging`: Logging de auditoria para operações sensíveis
- `document-management`: Upload/download de documentos
- `notifications`: Sistema de notificações email/SMS
- `rate-indexation`: Reajuste automático por índice
- `payment-reminders`: Lembretes de vencimento
- `analytics-dashboard`: Dashboard analítico

### Modified Capabilities

- `identity`: Adicionar 2FA e RBAC
- `property`: Adicionar documentos

## Impact

- Backend Go: novos pacotes em `internal/` (rate limiter, cors, csrf, rbac, audit, document, notification)
- Database: novas tabelas para roles, documentos, notificações, audit logs
- Frontend: novos componentes para 2FA, documents, notifications
- Dependências: golang.org/x/time/rate, redis (para rate limiting distribuído)
# Tasks: Security and Feature Enhancements

## Fase 1 - Segurança Semanas 1-2

### Tarefa 1: Rate Limiting

**Módulo:** `internal/ratelimit/`

- [x] Criar pacote `internal/ratelimit/` com rate limiter por IP
- [x] Implementar interface `RateLimiter` com opções Redis
- [x] Criar middleware chi para rate limiting
- [x] Adicionar headers X-RateLimit-* às respostas
- [x] Configurar via env vars: `RATE_LIMIT_IP`, `RATE_LIMIT_USER`
- [ ] Criar teste unitário para rate limiter

### Tarefa 2: CORS Whitelist

**Módulo:** adjustments em `cmd/api/main.go`

- [x] Implementar configuração CORS via `CORS_ALLOWED_ORIGINS`
- [x] Remover CORS allow-all (`*`)
- [x] Adicionar validação contra wildcard origin
- [ ] Testar com diferentes origins

### Tarefa 3: Audit Logging

**Módulo:** `internal/audit/`

- [x] Criar tabela `audit_logs` no migrations
- [x] Criar pacote `internal/audit/` com service e repository
- [ ] Implementar logging de login/logout
- [ ] Implementar logging de mutações (create/update/delete)
- [ ] Adicionar query endpoint para audit logs
- [x] Criar endpoint `/api/v1/audit-logs` (owner-only)

## Fase 2 - Autenticação Semanas 3-4

### Tarefa 4: RBAC System

**Módulo:** `internal/rbac/`

- [ ] Criar tabela `user_roles` no migrations
- [ ] Criar pacote `internal/rbac/` (model, repository, service)
- [ ] Adicionar campo `role` no model de User
- [ ] Criar middleware de autorização chi
- [ ] Implementar check de permissão por role
- [ ] Atualizar handlers existentes com autorização

### Tarefa 5: Two-Factor Auth

**Módulo:** adjustments em `internal/identity/`

- [ ] Adicionar campos 2FA no User (totp_secret, backup_codes, 2fa_enabled)
- [ ] Implementar TOTP generation (usar library `github.com/pquer/otpgenerate` ou similar)
- [ ] Criar endpoint `/api/v1/auth/2fa/enable`
- [ ] Criar endpoint `/api/v1/auth/2fa/verify`
- [ ] Criar endpoint `/api/v1/auth/2fa/disable`
- [ ] Implementar backup codes (10 códigos únicos)
- [ ] Atualizar login para requerer 2FA quando habilitado

## Fase 3 - Funcionalidades Semanas 5-6

### Tarefa 6: Document Management

**Módulo:** `internal/document/`

- [ ] Criar tabela `documents` no migrations
- [ ] Criar pacote `internal/document/`
- [ ] Implementar upload com validação (PDF, max 10MB)
- [ ] Implementar download
- [ ] Implementar delete
- [ ] Criar endpoints REST
- [ ] Configurar storage path via env var

### Tarefa 7: Notifications

**Módulo:** `internal/notification/`

- [ ] Criar tabela `notifications` no migrations
- [ ] Criar pacote `internal/notification/` com interface
- [ ] Implementar EmailService (SMTP)
- [ ] Implementar schedule/queue system
- [ ] Implementar retry logic (3 tentativas)
- [ ] Criar templates de email (payment reminder, contract expiring)
- [ ] Criar scheduling cron job

## Fase 4 - Melhorias Semanas 7-8

### Tarefa 8: Rate Indexation

**Módulo:** adjustments em `internal/lease/`

- [ ] Adicionar tabela `index_values` no migrations
- [ ] Criar endpoint para buscar índices (IPCA, IGP-M)
- [ ] Implementar cálculo de correção monetária
- [ ] Criar lógica de aviso 30 dias antes
- [ ] Implementar confirmação manual
- [ ] Adicionar scheduler para verificação anual

### Tarefa 9: Graceful Shutdown

**Módulo:** adjustments em `cmd/api/main.go`

- [ ] Adicionar signal handling (SIGINT, SIGTERM)
- [ ] Implementar context timeout para shutdown
- [ ] Adicionar timeout para conexões ativas
- [ ] Logging de shutdown

### Tarefa 10: API v2

**Módulo:** novo roteamento

- [ ] Criar grupo de rotas `/api/v2/`
- [ ] Manter `/api/v1/` funcionando (deprecated warnings)
- [ ] Documentar breaking changes
- [ ] Adicionar version header nas respostas

## Dependências Externas

Adicionar no Go.mod:

```
github.com/pquer/otpgenerate   # TOTP
github.com/go-redis/redis     # Redis para rate limiting (opicional)
gopkg.in/gomail.v2         # Email
```

## Migration Scripts

Novas tabelas necessárias:

- `000030_user_roles.up.sql` - user_roles table
- `000031_audit_logs.up.sql` - audit_logs table
- `000032_documents.up.sql` - documents table
- `000033_notifications.up.sql` - notifications table
- `000034_index_values.up.sql` - index_values table
- `000035_2fa_users.up.sql` - 2FA fields

## Testes

- [ ] Testes unitários para cada novo pacote
- [ ] Testes de integração para endpoints
- [ ] Testes E2E para fluxos 2FA
- [ ] Testes de stress para rate limiting
## Context

O backend Go do InquilinoTop atualmente:
- Usa chi v5 como router HTTP
- PostgreSQL com pgx v5
- JWT RS256 para autenticação
- 8 módulos funcionais: identity, property, tenant, lease, payment, expense, fiscal, support

**Stack atual:**
- Go 1.25
- chi v5
- pgx v5
- golang-migrate

**Dependências externas:**
- Provedores de pagamento (Asaas, Bradesco, Itaú, Sicoob)

## Goals / Non-Goals

**Goals:**
- Implementar rate limiting (100 req/min por IP, 200 req/min por usuário)
- Configurar CORS restritivo com whitelist
- Adicionar RBAC (owner, admin, viewer)
- Adicionar suporte a 2FA TOTP
- Implementar audit logging
- Sistema de documentos
- Sistema de notificações

**Non-Goals:**
- Mobile app
- Integração completa com GoCardless (futuro)
- Reescrever módulos existentes
- Migração do frontend para Go

## Decisions

### 1. Rate Limiting

**Decisão:** Usar `golang.org/x/time/rate` com Redis para rate limiting distribuído

**Alternativas consideradas:**
- In-memory (simples, mas não funciona em multi-instância)
- Token bucket com Redis (flexível, suporta múltiplas instâncias)
- go-chi/limiter (acoplado ao chi)

**Justificativa:** Produção exige múltiplas instâncias. Redis já está no projeto (usado?). Sem Redis, usar in-memory com advertencia. Implementar interface para swap.

### 2. CORS

**Decisão:** Configurar CORS com whitelist via variável de ambiente `CORS_ALLOWED_ORIGINS`

**Alternativas:**
- `*` (atual - inseguro)
- Whitelist fixo no código
- Whitelist via env var

**Justificativa:** Deploy em diferentes ambientes (dev, staging, prod) requer diferentes origins. Variável de ambiente permite配置flexível sem re-build.

### 3. RBAC

**Decisão:** Roles no nível de usuário (owner, admin, viewer)

**Justificativa:**
- owner: acesso total ao account
- admin: gestão de propriedades/tenants (não pode criar owner)
- viewer: apenas leitura

**Tabela:** `user_roles (user_id, role, property_id)` - role por usuário + propriedade

### 4. 2FA

**Decisão:** TOTP (Time-based One-Time Password) - Google Authenticator compatível

**Justificativa:**
- Padrão RFC 6238
- Sem necessidade de SMS/callback
- Compatível com Google Authenticator, Authy, etc.

**Fluxo:**
1. Usuário habilita 2FA nas settings
2. Servidor gera secret TOTP
3. Usuário escaneia QR code
4. Login requer email + senha + código TOTP

### 5. Audit Logging

**Decisão:** PostgreSQL para audit logs (tabela `audit_logs`)

**Justificativa:**
- Mesmo DB, mesma transação
- Consulta simples com SQL
- Alternativa: ELK/ClickHouse (overhead)

**Eventos a logged:**
- Login/logout
- Criação/edição/deleção de dados sensíveis
- Alteração de configuração
- Tentativas falhas

### 6. Sistema de Documentos

**Decisão:** Armazenamento em disco local com path configurável

**Alternativas:**
- S3 (custo, dependência externa)
- Disk local (simples, precisa de backup)
- Base64 em DB (não recomendável para PDFs grandes)

**Justificativa:** MVP com armazenamento local. Interface para swap com S3/Blob later.

**Tabela:** `documents (id, owner_id, entity_type, entity_id, filename, mime_type, size, path, created_at)`

### 7. Sistema de Notificações

**Decisão:** Interface abstrata com implementação email (SMTP)

**Justificativa:**
- Email é mais importante para property management
- SMS é custo adicional

**Interfaces:**
- `NotificationService` com método `Send(ctx, to, template, data)`
- Implementações: Email, SMS (futuro), Push (futuro)

**Tabela:** `notifications (id, owner_id, type, to, subject, body, status, scheduled_at, sent_at)`

### 8. Rate Indexation (Reajuste Automático)

**Decisão:** Calcular novo valor baseado em IPCA/IGP-M

**Justificativa:**
- Reajuste anual é obrigatório em contratos
- majority dos contratos usa IGP-M ou IPCA

**Fluxo:**
1. Scheduler verifica contratos próximos ao vencimento (30 dias)
2. Busca índice do mês anterior
3. Calcula novo valor
4. Cria novo lease com valores ajustados ou notifica usuário

### 9. Graceful Shutdown

**Decisão:** Implementar signal handling com context cancellation

**Justificativa:**
- Conexões em andamento completam
- DB connections fecham corretamente
- Logs finalizam

**Implementação:**
```go
func (s *Server) GracefulShutdown() {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()
    s.Shutdown(ctx)
}
```

### 10. API Versioning

**Decisão:** URL-based versioning `/api/v1/` → `/api/v2/`

**Justificativa:**
- Simples de implementar
- Clientes explicitam versão
- Maioria das APIs usa这种方法

**Migração:**
- v1 continua funcionando por 6 meses
- Nova funcionalidade apenas em v2

## Risks / Trade-offs

1. **[Rate Limiting]** Sem Redis = não funciona em multi-instância
   - **Mitigação:** Implementar interface, default in-memory com warning

2. **[2FA]** Usuário perde access se perder dispositivo
   - **Mitigação:** Backup codes (10 códigos únicos)

3. **[Documentos]** Disco lota em produção
   - **Mitigação:** Interface para S3, alertas de espaço

4. **[Notifications]** Email providers podem bloquear
   - **Mitigação:** Batch sending, retry logic

5. **[RBAC]** Complexidade adicional em cada query
   - **Mitigação:** Middleware de autorização, helper functions

## Migration Plan

**Fase 1 - Segurança (Semana 1-2)**
1. Rate limiting (in-memory, depois Redis)
2. CORS whitelist
3. Audit logging

**Fase 2 - Autenticação (Semana 3-4)**
4. RBAC
5. 2FA com backup codes

**Fase 3 - Funcionalidades (Semana 5-6)**
6. Documentos
7. Notificações

**Fase 4 - Melhorias (Semana 7-8)**
8. Rate indexation
9. Graceful shutdown
10. API v2

**Rollback:**
- Features são additive (não break existing API)
- Em caso de masalah, feature flag para desabilitar
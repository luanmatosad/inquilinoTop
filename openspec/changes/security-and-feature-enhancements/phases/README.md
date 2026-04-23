# Security and Feature Enhancements - Plano de Implementação

## Visão Geral

Este plano implementa melhorias de segurança e funcionalidades em 4 fases sequenciais.

| Fase | Tema | Tasks | Status |
|------|------|------|--------|
| 1 | Segurança Fundamental | 10 | ✅ Implementado |
| 2 | Autenticação Avançada | 12 | ⏳ Pendente |
| 3 | Recursos do Produto | 14 | ⏳ Pendente |
| 4 | Melhorias Técnicas | 13 | ⏳ Pendente |
| **Total** | | **61** | **10/61** |

---

## Fase 1: Segurança Fundamental ✅

**Arquivo:** `phases/fase-1-seguranca-fundamental.md`

- Rate Limiting (100 req/min IP, 200 req/min usuário)
- CORS Seguro (whitelist via env var)
- Audit Logging (endpoint `/api/v1/audit-logs`)

---

## Fase 2: Autenticação Avançada ⏳

**Arquivo:** `phases/fase-2-autenticacao-avancada.md`

### 2.1 RBAC System
- Tabela `user_roles`
- Pacote `internal/rbac/`
- Roles: owner, admin, viewer

### 2.2 Two-Factor Auth
- Campos 2FA na tabela users
- TOTP (Google Authenticator)
- Backup codes

---

## Fase 3: Recursos do Produto ⏳

**Arquivo:** `phases/fase-3-recursos-produto.md`

### 3.1 Document Management
- Upload/download de PDFs
- Limite 10MB

### 3.2 Notifications
- Email templates
- Scheduler de lembretes

---

## Fase 4: Melhorias Técnicas ⏳

**Arquivo:** `phases/fase-4-melhorias-tecnicas.md`

### 4.1 Rate Indexation
- Índices IPCA/IGP-M
- Cálculo automático

### 4.2 Graceful Shutdown
- Signal handling
- 30s timeout

### 4.3 API v2
- Versionamento
- Deprecation warnings

---

## Dependências Go

```go
github.com/pquer/otpgenerate  # TOTP
gopkg.in/gomail.v2            # Email SMTP
github.com/aws/aws-sdk-go      # S3 (futuro)
```

## Variáveis de Ambiente (Produção)

```bash
# CORS (obrigatório)
CORS_ALLOWED_ORIGINS=https://app.inquilinotop.com

# Rate Limiting (opcional)
RATE_LIMIT_IP=100
RATE_LIMIT_USER=200

# Storage
DOCUMENT_STORAGE_PATH=/var/data/inquilinotop/documents

# Email
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@inquilinotop.com
SMTP_PASSWORD=xxx
EMAIL_FROM=InquilinoTop <noreply@inquilinotop.com>
```

---

## Próximo Passo

Para implementar a **Fase 2** (RBAC + 2FA), execute:

```
/opsx:apply security-and-feature-enhancements
```

Ou peça-me para continuar implementando manualmente.
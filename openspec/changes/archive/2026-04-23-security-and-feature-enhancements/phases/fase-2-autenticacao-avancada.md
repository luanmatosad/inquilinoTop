# Fase 2: Autenticação Avançada

**Status:** ⏳ Pendente
**Tasks:** 12 tasks

## Ações Planejadas

### 2.1 RBAC System (roles e permissões)

**Módulo:** `internal/rbac/`

- [ ] Criar tabela `user_roles` no migrations
  - `user_id` UUID REFERENCES users(id)
  - `role` VARCHAR (owner|admin|viewer)
  - `property_id` UUID (opcional, para role por propriedade)
  - Indexes: (user_id), (property_id)

- [ ] Criar pacote `internal/rbac/`
  - `model.go` - Role struct + interface Repository
  - `repository.go` - pgRepository
  - `service.go` - CheckPermission, AssignRole
  - `middleware.go` - chi middleware para autorização

- [ ] Atualizar handlers existentes
  - property: admin+owner pueden criar
  - tenant: admin+owner pueden criar
  - viewer: solo leitura

### 2.2 Two-Factor Authentication (2FA)

**Módulo:** adjustments em `identity`

- [ ] Adicionar campos na tabela users
  - `totp_secret` VARCHAR (encrypted)
  - `backup_codes` TEXT[] (10 códigos)
  - `2fa_enabled` BOOLEAN DEFAULT false

- [ ] Implementar TOTP (RFC 6238)
  - Usar library `github.com/pquer/otpgenerate` ou similar
  - Setup: gerar secret + QR code URL
  - Verify: validar código TOTP
  - Backup codes: gerar 10 códigos únicos

- [ ] Criar endpoints identity
  - `POST /api/v1/auth/2fa/setup` - Iniciar 2FA
  - `POST /api/v1/auth/2fa/verify` - Verificar código
  - `POST /api/v1/auth/2fa/disable` - Desativar 2FA

- [ ] Atualizar login flow
  - Se 2FA habilitado → pedir código TOTP
  - Aceitar código TOTP OU backup code

## Arquivos a Criar/Modificar

```
backend/
├── migrations/
│   ├── 000020_create_user_roles.up.sql
│   └── 000021_add_2fa_fields.up.sql
└── internal/rbac/           # NOVO
    ├── model.go
    ├── repository.go
    ├── service.go
    └── middleware.go

# Modificar
backend/internal/identity/
  - model.go       # + campos 2FA
  - handler.go    # + endpoints 2FA
  - service.go   # + lógica 2FA
```

## Dependências Go

```go
github.com/pquer/otpgenerate  # TOTP
golang.org/x/crypto/bcrypt    # já tem
```

## Fluxo 2FA

```
1. Usuário vai em Settings → Segurança → Ativar 2FA
2. Servidor gera secret TOTP
3. Usuário escaneia QR (Google Authenticator)
4. Usuário confirma com código
5. Servidor habilita 2FA + gera backup codes
6. Login subsequente pede código TOTP
```
# identity — Autenticação e Usuários

Gerencia registro, login, refresh, logout e 2FA (TOTP). Único módulo sem `authMW` nas rotas. Integra com `audit` via interface.

## Modelos

| Struct | Campos chave |
|---|---|
| `User` | id, email, password_hash (json:"-"), plan, totp_secret?, backup_codes?, two_factor_enabled, created_at, updated_at |
| `RefreshToken` | id, user_id, token_hash (json:"-"), expires_at, revoked_at |
| `TwoFactorSetup` | secret, qr_code_url, backup_codes |
| `AuthResult` | user, access_token, refresh_token, two_factor_required?, temp_token? |

## Rotas (públicas, sem authMW)

| Método | Rota | Retorna |
|---|---|---|
| POST | /api/v1/auth/register | 201 `AuthResult` |
| POST | /api/v1/auth/login | 200 `AuthResult` (ou `{two_factor_required: true, temp_token}`) |
| POST | /api/v1/auth/refresh | 200 `{access_token, refresh_token}` |
| POST | /api/v1/auth/logout | 200 `{logged_out: true}` |
| POST | /api/v1/auth/2fa/login | 200 `AuthResult` (troca `temp_token` + código por tokens reais) |

## Rotas autenticadas (Bearer)

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/auth/profile | perfil (se existir) + `email` + `two_factor_enabled`; nunca o segredo nem os códigos de recuperação |
| PUT | /api/v1/auth/profile | perfil atualizado |
| POST | /api/v1/auth/2fa/setup | segredo **pendente** do próprio usuário: `{secret, qr_code_url}`; 409 `ALREADY_ENABLED` se já ativo. Sem corpo |
| POST | /api/v1/auth/2fa/verify | `{code}`: confirma o TOTP, **liga** o 2FA e devolve `{two_factor_enabled, backup_codes}` (10 códigos de 10 dígitos, só aqui). 400 `INVALID_CODE`, 409 `NOT_CONFIGURED`/`ALREADY_ENABLED` |
| POST | /api/v1/auth/2fa/disable | `{password}`: desativa |
| POST | /api/v1/auth/password | `{current_password, new_password}`: 400 `INVALID_PASSWORD`, `WEAK_PASSWORD` (< 8) ou `SAME_PASSWORD`; não derruba outras sessões |
| GET/PUT | /api/v1/auth/notification-preferences | preferências (nada no backend as lê ainda) |

## Regras de Negócio

- Senha hasheada com `bcrypt`. Refresh token: hash SHA-256 armazenado no banco.
- Login com 2FA ativo: retorna `temp_token` (UUID) + `two_factor_required: true`; não emite access_token ainda.
- `temp_token` expira automaticamente (CleanupExpiredTempTokens chamado no Login).
- `Register` → 409 se email já existe. Validação: email sem `@` → `INVALID_EMAIL`; senha < 8 → `WEAK_PASSWORD`.
- Audit: `NewServiceWithAudit(repo, jwtSvc, logger)` integra `AuditLogger`. Default é `NoopAuditLogger`.

## Gotchas

- `io.ReadFull` obrigatório em `rand.Read` — não usar `rand.Read` direto (detecta leitura parcial).
- O login com 2FA usa `2fa/login` com `temp_token`; `2fa/verify` é autenticada e serve para **ativar**.
- **2FA seguro:** o setup nunca recebe e-mail (usa o usuário do token) e deixa o segredo pendente; só `verify` liga. `verifyTOTP` precisa olhar o booleano de `Validate` (retorna `false, nil` para código errado). Códigos de recuperação ainda ficam em texto puro no banco (hash é follow-up).

## Decisões

- [0001 - JWT RS256 em vez de HS256](../../../docs/decisions/identity/0001-jwt-rs256.md)
- [0002 - Refresh token hash SHA-256 + fluxo 2FA com temp_token](../../../docs/decisions/identity/0002-refresh-token-hash-2fa-temp-token.md)

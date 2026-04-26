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
| POST | /api/v1/auth/2fa/verify | 200 `AuthResult` (troca temp_token por tokens reais) |
| POST | /api/v1/auth/2fa/setup | 200 `TwoFactorSetup` |
| POST | /api/v1/auth/2fa/enable | 200 confirma ativação do 2FA |
| POST | /api/v1/auth/2fa/disable | 200 desativa 2FA |

## Regras de Negócio

- Senha hasheada com `bcrypt`. Refresh token: hash SHA-256 armazenado no banco.
- Login com 2FA ativo: retorna `temp_token` (UUID) + `two_factor_required: true`; não emite access_token ainda.
- `temp_token` expira automaticamente (CleanupExpiredTempTokens chamado no Login).
- `Register` → 409 se email já existe. Validação: email sem `@` → `INVALID_EMAIL`; senha < 8 → `WEAK_PASSWORD`.
- Audit: `NewServiceWithAudit(repo, jwtSvc, logger)` integra `AuditLogger`. Default é `NoopAuditLogger`.

## Gotchas

- `io.ReadFull` obrigatório em `rand.Read` — não usar `rand.Read` direto (detecta leitura parcial).
- `2fa/verify` usa `temp_token` — não Bearer token.

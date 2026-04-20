# identity — Autenticação e Usuários

Gerencia registro, login, refresh e logout. Único módulo sem `authMW` nas rotas.

## Modelos

| Struct | Campos chave |
|---|---|
| `User` | id, email, password_hash (json:"-"), plan, created_at, updated_at |
| `RefreshToken` | id, user_id, token_hash (json:"-"), expires_at, revoked_at |

## Rotas (públicas, sem authMW)

| Método | Rota | Handler | Retorna |
|---|---|---|---|
| POST | /api/v1/auth/register | register | 201 `{user, access_token, refresh_token}` |
| POST | /api/v1/auth/login | login | 200 `{user, access_token, refresh_token}` |
| POST | /api/v1/auth/refresh | refresh | 200 `{access_token, refresh_token}` |
| POST | /api/v1/auth/logout | logout | 200 `{logged_out: true}` |

## Validações no Handler

- email vazio → `MISSING_FIELDS`
- email sem `@` → `INVALID_EMAIL`
- senha < 8 chars → `WEAK_PASSWORD`

## Regras de Negócio (service.go)

- Senha hasheada com `bcrypt`
- Refresh token: gerado aleatoriamente, armazenado apenas o hash no banco
- `Logout` revoga o refresh token (sem erro se já revogado)
- `Register` retorna `REGISTER_FAILED` (409) se email já existe

## Repository Interface

```go
CreateUser(ctx, email, passwordHash) (*User, error)
GetUserByEmail(ctx, email) (*User, error)
GetUserByID(ctx, id) (*User, error)
CreateRefreshToken(ctx, userID, tokenHash, expiresAt) (*RefreshToken, error)
GetRefreshToken(ctx, tokenHash) (*RefreshToken, error)
RevokeRefreshToken(ctx, tokenHash) error
```

## Validação de Identity (validation_test.go)

Arquivo `internal/identity/validation_test.go` testa regras de validação de email/senha isoladamente.

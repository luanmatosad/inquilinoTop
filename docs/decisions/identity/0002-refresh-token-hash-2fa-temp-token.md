# 0002 - Refresh token hash SHA-256 + fluxo 2FA com temp_token

**Status**: Accepted

## Context

Tokens de acesso (JWT RS256, [0001](./0001-jwt-rs256.md)) têm vida curta (15min) e precisam de um mecanismo de renovação. Além disso, o sistema suporta 2FA via TOTP (`User.totp_secret`, `two_factor_enabled`) — o fluxo de login precisa lidar com usuários que têm 2FA ativo sem emitir tokens de acesso reais antes da segunda verificação.

## Decision

**Refresh token**: armazenado no banco (`RefreshToken.token_hash`) como hash SHA-256 do valor real, nunca em texto plano. O valor real só existe no cliente; o servidor compara hash contra hash em `/api/v1/auth/refresh`.

**2FA**: login com `two_factor_enabled=true` retorna `{two_factor_required: true, temp_token}` em vez de tokens reais — `temp_token` é um UUID de vida curta que não concede nenhum acesso por si só, só autoriza a chamada subsequente a `/api/v1/auth/2fa/verify`, que troca o `temp_token` pelos tokens de acesso/refresh reais.

## Consequences

- Um dump do banco não expõe refresh tokens válidos (hash SHA-256 unidirecional) — comprometimento de banco não implica sequestro de sessão ativa
- `temp_token` precisa expirar rápido e ser de uso único — se não for invalidado após o `verify`, vira uma janela de replay
- Fluxo de login tem dois formatos de resposta possíveis (`AuthResult` direto, ou `{two_factor_required, temp_token}`) — todo client precisa tratar os dois casos
- `identity` é o único módulo sem `authMW` nas rotas (`/api/v1/auth/*` são públicas por natureza — é o próprio ponto de entrada da autenticação)

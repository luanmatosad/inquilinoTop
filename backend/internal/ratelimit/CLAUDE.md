# ratelimit — Rate Limiting

Middleware HTTP de rate limiting por IP e por usuário autenticado. Implementação token bucket própria (sem biblioteca externa).

## Config

```go
ratelimit.NewMiddleware(ratelimit.Config{
    IPRate: 1.0, IPBurst: 100,       // anônimos: 100 req/s
    UserRate: 2.0, UserBurst: 200,   // autenticados: 200 req/s
})
```

## Comportamento

- Usuário autenticado (`auth.OwnerIDFromCtx` retorna não-nil): usa `userLimiter` (200 burst).
- Anônimo: usa `limiter` por IP (100 burst). IP extraído de `X-Forwarded-For` → `X-Real-IP` → `RemoteAddr`.
- Limite excedido → 429 `RATE_LIMIT_EXCEEDED` / `USER_RATE_LIMIT_EXCEEDED`.
- Headers retornados: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Cleanup automático: goroutine remove entries inativos há >10min, a cada 5min.

## Gotchas

- `X-RateLimit-Remaining` é estático (99 ou 199) — não reflete valor real de tokens restantes.
- `LimiterByID` é limiter adicional por UUID — disponível para uso programático, não usado no middleware padrão.

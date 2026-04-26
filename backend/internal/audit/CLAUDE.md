# audit — Log de Auditoria

Registra eventos de segurança e ações do sistema. Consumido pelo `identity` via interface `AuditLogger`.

## Modelo

`AuditLog`: id, owner_id, user_id?, event_type, entity_type?, entity_id?, ip_address?, user_agent?, details (jsonb), created_at

EventTypes: `LOGIN`, `LOGOUT`, `FAILED_LOGIN`, `CREATE`, `UPDATE`, `DELETE`, `PERMISSION_DENIED`

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/audit-logs?from=&to=&event_type= | lista filtrada (query params opcionais) |
| POST | /api/v1/audit-logs | 201 audit log |

## Integração com identity

`identity.AuditLogger` interface (definida em `identity/model.go`): `LogLogin`, `LogLogout`, `LogFailedLogin`. O service identity recebe `AuditLogger` via `NewServiceWithAudit`. `NoopAuditLogger` é o default quando auditoria não está configurada.

## Gotchas

- Sem soft-delete — logs são imutáveis.
- `List` filtra por `owner_id` + query params opcionais (`from`, `to`, `event_type`).
- `details` é `interface{}` no Go / `jsonb` no Postgres — aceita qualquer estrutura.

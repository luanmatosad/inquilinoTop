# notification — Notificações

Envia e gerencia notificações por email/SMS/push. Depende de `EmailSender` interface.

## Modelo

`Notification`: id, owner_id, type (email|sms|push), to_address, subject, body, status (pending|sent|failed), scheduled_at?, sent_at?, retry_count, created_at

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/notifications?status= | lista por owner (filtro status opcional) |
| POST | /api/v1/notifications | 201 notification |

## Repository

| Método | Nota |
|---|---|
| `ListPending(limit)` | Sem filtro owner — para worker de envio |
| `ListByOwner(ownerID, status)` | Com filtro owner — para API |
| `UpdateStatus` | Atualiza status + sent_at |
| `IncrementRetry` | Para lógica de retry |

## Gotchas

- Segurança: `ListByOwner` filtra por `owner_id` — vulnerabilidade de cross-owner leak foi corrigida (fix commit `c45e1d08`).
- `ListPending` é para processamento interno (sem ownerID) — nunca expor diretamente na API pública.
- `EmailSender` é interface — injetada no service para facilitar mock em testes.

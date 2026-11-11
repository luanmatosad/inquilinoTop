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
| `ListPending(limit)` | Sem filtro owner — devolve ids candidatos para o worker (não reserva) |
| `ReserveAndSend(id, send)` | Reserva a linha com `FOR UPDATE SKIP LOCKED` em transação curta; envia e grava `sent`+`sent_at`, ou incrementa `retry_count` (vira `failed` ao atingir `MaxRetries`) antes do COMMIT. Linha reservada por outro worker é pulada sem erro |

## Gotchas

- Segurança: `ListByOwner` filtra por `owner_id` — vulnerabilidade de cross-owner leak foi corrigida (fix commit `c45e1d08`).
- `ListPending` é para processamento interno (sem ownerID) — nunca expor diretamente na API pública.
- Envio é at-least-once: crash entre o envio e o COMMIT reenvia o e-mail. Falha incrementa `retry_count`; ao atingir `MaxRetries` (5) o status vira `failed` e a notificação sai da fila (`ListPending` e `ReserveAndSend` não a consideram mais).
- `EmailSender` é interface — injetada no service para facilitar mock em testes.

## Decisões

- [0001 - Separação ListPending / ListByOwner](../../../docs/decisions/notification/0001-separacao-listpending-listbyowner.md)

# support — Chamados de Suporte

CRUD de tickets de suporte dos usuários. Filtra por `user_id` (não `owner_id`).

## Modelo

`Ticket`: id, user_id, tipo (BUG|FEATURE|DOUBT|PAYMENT), assunto (max 200), descricao (max 5000), status, created_at, updated_at

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/support/tickets | lista do usuário autenticado |
| POST | /api/v1/support/tickets | 201 ticket |
| GET | /api/v1/support/tickets/{id} | ticket |

## Gotchas

- Usa `user_id` (não `owner_id`) — tickets são do usuário, não do owner de imóveis.
- Sem Update/Delete — tickets são imutáveis após criação.
- `tipo` aceita apenas: `BUG`, `FEATURE`, `DOUBT`, `PAYMENT`.

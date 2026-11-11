# support — Chamados de Suporte

CRUD de tickets de suporte dos usuários. Filtra por `user_id` (não `owner_id`).

## Modelo

`Ticket`: id, organization_id (opcional, null se o usuário não tem organização), user_id, tipo (BUG|FEATURE|DOUBT|PAYMENT), assunto (max 200), descricao (max 5000), status, created_at, updated_at

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/tickets | lista do usuário autenticado |
| POST | /api/v1/tickets | 201 ticket |
| GET | /api/v1/tickets/{id} | ticket |

## Gotchas

- Usa `user_id` (não `owner_id`) — tickets são do usuário, não do owner de imóveis.
- Sem Update/Delete — tickets são imutáveis após criação.
- `tipo` aceita apenas: `BUG`, `FEATURE`, `DOUBT`, `PAYMENT`.
- Só exige autenticação (`authMW`), sem `orgReadMw`: qualquer usuário logado abre ticket, mesmo sem organização.
- `organization_id` é gravado como NULL quando o contexto não tem org; leituras filtram com `organization_id IS NOT DISTINCT FROM`, então um ticket criado sem org só aparece sem org, e um ticket com org só aparece com a mesma org.

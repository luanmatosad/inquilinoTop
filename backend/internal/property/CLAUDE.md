# property — Imóveis e Unidades

Um módulo trata Property + Unit juntos. Repository interface tem 10 métodos (5 Property + 5 Unit).

## Modelos

| Struct | Campos chave |
|---|---|
| `Property` | id, owner_id, type (RESIDENTIAL\|SINGLE), name, address_line?, city?, state?, is_active |
| `Unit` | id, property_id, label, floor?, notes?, is_active |

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/properties | lista (owner) |
| POST | /api/v1/properties | 201 property |
| GET | /api/v1/properties/{id} | property |
| PUT | /api/v1/properties/{id} | property atualizado |
| DELETE | /api/v1/properties/{id} | `{deleted: true}` |
| GET | /api/v1/properties/{id}/units | lista units da property |
| POST | /api/v1/properties/{id}/units | 201 unit |
| GET | /api/v1/units/{id} | unit |
| PUT | /api/v1/units/{id} | unit atualizado |
| DELETE | /api/v1/units/{id} | `{deleted: true}` |

## Invariantes

- **SINGLE auto-unit**: `CreateProperty(SINGLE)` cria automaticamente `Unit{Label: "Unidade 01", Notes: "Unidade criada automaticamente"}` — feito no service.
- `CreateUnit` verifica `ownerID` via `GetByID` antes de criar (autorização).
- Soft-delete em todas as deleções (`is_active=false`).
- Unit ops (get/update/delete) NÃO verificam `ownerID` diretamente — confiar no property_id.

## Gotchas

- `GetUnit` não recebe `ownerID` — acesso não filtrado por owner. Cuidado ao expor diretamente.
- `CreatePropertyInput` é reutilizado em Update (sem campo `type` — type não muda após criação na prática, mas a struct permite).
- `handler.createUnit` passa `ownerID` ao service, mas o repo ignora — a verificação é feita pelo service via `GetByID`.

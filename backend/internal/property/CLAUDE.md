# property — Imóveis e Unidades

Um módulo trata Property + Unit juntos. Repository interface tem 10 métodos (5 Property + 5 Unit).

## Modelos

| Struct | Campos chave |
|---|---|
| `Property` | id, organization_id, type (RESIDENTIAL\|SINGLE), name, address_line?, city?, state?, postal_code? (8 dígitos), neighborhood?, is_active |
| `Unit` | id, property_id, label, floor?, notes?, area_m2? (>0), bedrooms? (>=0), bathrooms? (>=0), is_active |

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
- **Rótulo de unidade único** por imóvel entre ativas, sem diferenciar maiúsculas/espaços: service checa via `ListUnits` e o índice `uq_units_property_label_active` é a rede contra corrida. Erro `ErrDuplicateUnitLabel` (envolve `apierr.ErrConflict`) → 409 `DUPLICATE_UNIT_LABEL`.
- `postal_code` chega sem máscara (validator `len=8,numeric`); medidas negativas → 400.
- Unit ops (get/update/delete) NÃO verificam `ownerID` diretamente — confiar no property_id.

## Gotchas

- `GetUnit`, `UpdateUnit`, `DeleteUnit` AGORA recebem `ownerID` e fazem o JOIN com `properties` para validar owner (IDOR corrigido em commit `6269ffa`).
- `CreatePropertyInput` é reutilizado em Update (sem campo `type` — type não muda após criação).
- `handler.createUnit` passa `ownerID` ao service, verificação via JOIN em property.

## Decisões

- [0001 - SINGLE auto-cria Unit](../../../docs/decisions/property/0001-single-auto-cria-unit.md)

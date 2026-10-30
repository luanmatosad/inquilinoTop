# inspection — Laudos de vistoria

Registra o estado do imóvel na **entrada** (`ENTRY`) e na **saída** (`EXIT`) de um contrato, com itens por ambiente e fotos. Apoia decisões sobre caução e danos. Decisões: [inspection-0001](../../../docs/decisions/inspection/0001-laudo-unico-por-tipo-imutavel-e-fotos-proprias.md).

## Modelo

- `Inspection`: id, organization_id, lease_id, type (ENTRY|EXIT), status (DRAFT|COMPLETED), inspected_at, general_notes?, completed_at?, is_active
- `Item`: id, inspection_id, room, item, condition (GOOD|FAIR|POOR|DAMAGED|NOT_APPLICABLE), notes?, position, is_active, `photos[]`
- `Photo`: id, item_id, filename, mime_type, size_bytes (o caminho do arquivo nunca é exposto)
- `Detail` = `Inspection` + `items[]` (nunca nil)

Tabelas `inspections`, `inspection_items`, `inspection_photos` (migrations 000043–000045). Itens e fotos não têm `organization_id`: toda query faz JOIN com `inspections` e filtra a organização.

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/inspections?lease_id=&type=&status= | lista (`[]` se vazia) |
| POST | /api/v1/inspections | 201 detalhe; `copy_from_entry` copia itens da entrada num EXIT |
| GET / PUT / DELETE | /api/v1/inspections/{id} | detalhe / laudo / `{deleted}` (soft-delete) |
| POST | /api/v1/inspections/{id}/complete | conclui (exige ao menos 1 item) |
| POST | /api/v1/inspections/{id}/items | 201 item |
| PUT / DELETE | /api/v1/inspections/{id}/items/{itemId} | item / `{deleted}` |
| POST | /api/v1/inspections/{id}/items/{itemId}/photos | 201 foto (multipart `file`) |
| DELETE | /api/v1/inspections/{id}/items/{itemId}/photos/{photoId} | `{deleted}` |
| GET | /api/v1/inspection-photos/{photoId} | bytes da imagem |
| GET | /api/v1/leases/{id}/inspections/compare | comparação entrada × saída |

Permissões: reaproveita `lease:read` (leituras) e `lease:write` (escritas).

## Regras

- **Um laudo ativo por tipo por contrato** (índice único parcial). Duplicado → 409 `INSPECTION_DUPLICATE`. Excluir (soft-delete) libera o tipo.
- **Só `DRAFT` edita** dados, itens e fotos. `COMPLETED` → 409 `INSPECTION_NOT_EDITABLE` (a leitura das fotos continua). Concluir sem itens → 422 `INSPECTION_WITHOUT_ITEMS`.
- Contrato inexistente ou de outra organização → 404 `LEASE_NOT_FOUND`.
- **Comparação**: exige `ENTRY` e `EXIT` concluídos (senão 409 `COMPARISON_UNAVAILABLE`). Pareia por ambiente + item, sem caixa nem espaços nas pontas; itens só de um lado vêm com o outro nulo. `worsened=true` quando a saída é pior na ordem GOOD < FAIR < POOR < DAMAGED; `NOT_APPLICABLE` nunca piora. Chave repetida dentro de um laudo: vale o primeiro item.
- **Fotos**: JPEG/PNG/WebP, tipo conferido pelos primeiros bytes (não pelo cabeçalho), até 10 MB (413 `PHOTO_TOO_LARGE`), 10 por item (422 `PHOTO_LIMIT`, aplicado em transação com o item travado), tipo inválido → 400 `INVALID_PHOTO`. Guardadas em pasta por organização; remoção é lógica e o arquivo fica no disco.
- Criar e concluir geram auditoria. `audit.Service` recebe o **usuário** como "owner" (FK para `users`); a organização vem do contexto.

## Gotchas

- Handlers escopam por `OrganizationIDFromCtx`; `OwnerIDFromCtx` é o usuário (só para auditoria e `uploaded_by`).
- `copy_from_entry` copia também a condição de cada item: a UI precisa chamar a atenção para reavaliar.
- Dependências por interface (`LeaseReader`, `Auditor`, `Storage`), ligadas em `cmd/api/main.go` (`WithAuditor`, `WithStorage`).

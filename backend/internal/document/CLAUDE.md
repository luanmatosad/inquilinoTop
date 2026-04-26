# document — Gerenciamento de Documentos

Upload e listagem de arquivos vinculados a entidades (property, unit, lease, tenant).

## Modelo

`Document`: id, owner_id, entity_type, entity_id, filename, mime_type, size_bytes (max 10MB), file_path, created_at

`CreateDocumentInput`: entity_type (oneof: property|unit|lease|tenant), entity_id (uuid), filename (max 255), mime_type, size_bytes (1–10485760)

## Interfaces

- `Storage`: `Save(ownerID, filename, reader) → filePath`, `Load(path) → ReadCloser`, `Delete(path)` — abstração de armazenamento de arquivo.
- `Repository`: `Create`, `GetByID`, `ListByEntity`, `Delete`

## Rotas

| Método | Rota | Retorna |
|---|---|---|
| GET | /api/v1/documents?entity_type=&entity_id= | lista por entidade |
| POST | /api/v1/documents | 201 document |
| GET | /api/v1/documents/{id} | document |
| DELETE | /api/v1/documents/{id} | `{deleted: true}` |

## Gotchas

- `Storage` é interface — implementação não definida no código (filesystem, S3, etc.).
- Delete remove registro do banco E o arquivo via `Storage.Delete`.
- `entity_type` é validado: só aceita `property`, `unit`, `lease`, `tenant`.

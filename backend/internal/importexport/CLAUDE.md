# importexport

Importação em lote (CSV já parseado no cliente) com histórico. Histórico escopado por `owner_id`; entidades importadas escopadas por `organization_id`.

## Endpoints (`/api/v1`)

| Método | Rota |
|---|---|
| POST | `/import` — body `{entity_type, records: [map[string]string], duplicate_strategy}` → `{import_id, imported, failed, skipped, errors[]}` |
| GET | `/import/history` |

## Fluxo

`ImportRecords(ctx, ownerID, userID, orgID, req)`: cria `ImportHistory` -> `PROCESSING` -> importa registro a registro (erros por linha não abortam, mensagem prefixada com `linha N:`) -> `COMPLETED`, ou `FAILED` só se todas as linhas falharam (`skipped` não conta como falha). Erros de `UpdateImportHistory` são retornados (500 `IMPORT_FAILED`).

## Entidades

- **tenant**: delega a `tenant.Service.Create` (interface local `TenantCreator`), que valida `person_type`, nome, CPF/CNPJ (grava só dígitos) e devolve `tenant.ErrDuplicateDocument`. Mapeamento: `name`; `cpf`/`cnpj`/`document` -> Document; `email`, `phone`, `postal_code`, `address_line`, `city`, `state`, `notes`. `person_type` = `PJ` se vier `cnpj` ou `person_type=PJ`, senão `PF`. Campos vazios viram `nil`.
- **property** e tipos desconhecidos: erro por linha `entity_type "x" não suportado` (contam como `failed`). Import de property fora do escopo.

## Duplicatas (`duplicate_strategy`)

- `"skip"`: duplicata conta em `skipped` (nem `imported` nem `failed`).
- Qualquer outro valor/vazio: duplicata conta como `failed` ("documento já cadastrado").

## Gotchas

- Escopo: handler usa `auth.OrganizationIDFromCtx` (401 `UNAUTHORIZED` se ausente) como `orgID`; `userID` = `auth.OwnerIDFromCtx` (mesmo padrão do handler de tenant). Histórico segue com `ownerID`.
- `skipped` só existe na resposta; histórico não tem coluna para isso (sem migration).

## Why

O MVP começa pelos cadastros de imóvel, unidade e inquilino. O backend Go e as telas já existem, mas o cadastro é raso (sem CEP, área, endereço do inquilino), não impede duplicidade e há duas árvores de rotas no frontend (`/properties`, `/tenants` e `/owner/properties`, `/owner/tenants`) lendo a mesma API. Sem isso, contratos e cobranças nascem sobre dados incompletos e repetidos.

## What Changes

- Imóvel ganha `postal_code` e `neighborhood`; unidade ganha `area_m2`, `bedrooms` e `bathrooms`.
- Inquilino ganha endereço (`postal_code`, `address_line`, `city`, `state`) e `notes`.
- Validação de documento (CPF para PF, CNPJ para PJ) e unicidade de documento por organização (entre ativos).
- Unicidade de rótulo de unidade dentro do imóvel (entre ativas).
- Frontend: formulários de imóvel, unidade e inquilino cobrem os campos novos, com estados de carregamento, vazio e erro.
- Frontend: consolidar em uma única árvore de rotas (`/properties`, `/tenants`, as já usadas no `Sidebar`) e remover `/owner/properties` e `/owner/tenants`. `/owner/settings` permanece.
- Atualizar `CLAUDE.md` raiz: property, tenant, lease, payment e expense já usam a Go API.
- **BREAKING**: rotas `/owner/properties/**` e `/owner/tenants/**` deixam de existir (redirect para as novas).

## Capabilities

### New Capabilities
- `property-registry`: cadastro de imóveis e unidades com dados completos e sem duplicidade.
- `tenant-registry`: cadastro de inquilinos PF/PJ com documento válido, endereço e sem duplicidade.

### Modified Capabilities
<!-- Nenhum spec existente cobre esses domínios. -->

## Impact

- **Backend**: `internal/property` e `internal/tenant` (model, repository, service, handler, testes), migrations `000036_add_property_unit_fields` e `000037_add_tenant_address`, pacote de validação de CPF/CNPJ em `pkg/`, Swagger.
- **Frontend**: `src/app/properties/**`, `src/app/tenants/**`, `src/components/{properties,tenants}`, `src/data/owner/{properties,tenants}-dal.ts`, `src/lib/schemas.ts`, `Sidebar`, redirects em `next.config.ts`.
- **Dados**: colunas novas nullable; sem backfill. Duplicidades já existentes não quebram a migration (índice único parcial só vale para novos/atualizados, ver design).
- **Fora de escopo**: fotos, matrícula, dados de aquisição, edifícios/rateio, fiadores, contatos de emergência, convite ao portal.
- **Coordenação de migrations**: as três changes do MVP usam `000036` em diante na ordem 1 → 2 → 3; `add-laudo-vistoria` deve ser renumerada para depois delas.

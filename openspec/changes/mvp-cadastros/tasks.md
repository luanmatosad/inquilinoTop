## 1. Banco de dados

- [x] 1.1 Verificar duplicidades legadas (documento de inquilino por organização; rótulo de unidade por imóvel) e listar antes de migrar
- [x] 1.2 Escrever `000036_add_property_unit_fields` up/down (`postal_code`, `neighborhood`; `area_m2`, `bedrooms`, `bathrooms`; índice único parcial de rótulo)
- [x] 1.3 Escrever `000037_add_tenant_address` up/down (endereço, `notes`; índice único parcial `(organization_id, document)`)
- [x] 1.4 Aplicar e reverter no Postgres de testes (`:5433`)

## 2. Backend: validação e erros

- [x] 2.1 Criar `pkg/brdoc` com `ValidCPF`/`ValidCNPJ`/`OnlyDigits` e testes (válidos, inválidos, repetidos como 111.111.111-11)
- [x] 2.2 Adicionar `apierr.ErrConflict` (se não existir) e mapear para 409 nos handlers

## 3. Backend: property e unit (TDD)

- [x] 3.1 Atualizar `model.go` (campos novos, inputs com `validate`)
- [x] 3.2 Escrever testes de service: CEP, área/quartos negativos, rótulo duplicado, rótulo de unidade inativa, SINGLE auto-cria unidade
- [x] 3.3 Implementar service e repository com os campos novos e filtro por organização
- [x] 3.4 Testes de integração do repositório (soft-delete, índice único)
- [x] 3.5 Atualizar handler, Swagger e `internal/property/CLAUDE.md`

## 4. Backend: tenant (TDD)

- [x] 4.1 Atualizar `model.go` (endereço, `notes`)
- [x] 4.2 Escrever testes de service: CPF/CNPJ por tipo, documento duplicado (criar e atualizar), outra organização, reuso após exclusão, exclusão com contrato ativo
- [x] 4.3 Implementar service (usa `GetByField`) e repository; checagem de contrato ativo via interface
- [x] 4.4 Testes de integração do repositório
- [x] 4.5 Atualizar handler, Swagger e `internal/tenant/CLAUDE.md`
- [x] 4.6 Conferir impacto em `importexport` (documentos importados validados e deduplicados) e ajustar
- [ ] 4.7 `make test-backend` e `make test-backend-integration` sem falhas

## 5. Frontend: consolidação de rotas

- [ ] 5.1 Comparar `/owner/properties|tenants` com `/properties|tenants` e listar funcionalidades que só existem nas rotas `/owner`
- [ ] 5.2 Portar o que faltar para `/properties` e `/tenants`
- [ ] 5.3 Unificar DALs e actions em um cliente por domínio e remover duplicados
- [ ] 5.4 Remover `/owner/properties/**` e `/owner/tenants/**`; adicionar redirects permanentes em `next.config.ts`

## 6. Frontend: formulários

- [ ] 6.1 Schemas Zod de imóvel, unidade e inquilino em `src/lib/schemas.ts` (CPF/CNPJ, CEP, UF)
- [ ] 6.2 Formulário de imóvel e unidade com campos novos (shadcn/ui, react-hook-form)
- [ ] 6.3 Formulário de inquilino com endereço, máscaras e erro `DUPLICATE_DOCUMENT` no campo
- [ ] 6.4 Estados de carregamento, vazio e erro nas listas de imóveis e inquilinos

## 7. Documentação e verificação

- [ ] 7.1 Atualizar `CLAUDE.md` raiz (status Frontend dos módulos: Go API)
- [ ] 7.2 `make frontend-lint` e build sem erros
- [ ] 7.3 Fluxo manual: criar imóvel SINGLE, unidade, inquilino PF, tentar duplicar CPF e unidade
- [ ] 7.4 `openspec validate mvp-cadastros`

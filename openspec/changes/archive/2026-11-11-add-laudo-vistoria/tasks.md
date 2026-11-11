## 1. Banco de dados

- [x] 1.1 Escrever `000043_create_inspections.up/down.sql` (tabela, FKs, CHECK de `type` e `status`, índice único parcial `(lease_id, type) WHERE is_active`)
- [x] 1.2 Escrever `000044_create_inspection_items.up/down.sql` (CHECK de `condition`, índice por `inspection_id`)
- [x] 1.3 Aplicar e reverter as migrations no Postgres de testes (`:5433`) sem erro

## 2. Backend: modelo e testes (TDD)

- [x] 2.1 Criar `internal/inspection/model.go` com tipos, enums, inputs com `validate` e a interface `Repository`
- [x] 2.2 Escrever `service_test.go` com mock local cobrindo: criação, contrato de outra organização, duplicidade por tipo, edição de laudo concluído, conclusão sem itens, cópia da entrada, comparação
- [x] 2.3 Implementar `service.go` até os testes passarem (`LeaseReader` por interface, erros com `errors.Is` e wrapping `inspection.svc:`)
- [x] 2.4 Escrever `repository_test.go` de integração com helper `testDB` (filtro por `organization_id`, soft-delete, unicidade parcial)
- [x] 2.5 Implementar `repository.go` (`pgRepository`, `inspection.repo:`), itens sempre via join com a organização
- [x] 2.6 Registrar criar e concluir laudo no `audit`

## 3. Backend: API

- [x] 3.1 Escrever `handler_test.go` (UUID inválido, body inválido, 404, 409 `INSPECTION_NOT_EDITABLE`, lista `[]`)
- [x] 3.2 Implementar `handler.go` com rotas de `/api/v1/inspections`, itens, `complete` e `GET /api/v1/leases/{id}/inspections/compare`, `authMW` por rota e permissão RBAC
- [x] 3.3 Adicionar annotations Swagger completas e rodar `swag init`
- [x] 3.4 Compor repositório, service e handler em `cmd/api/main.go`
- [x] 3.5 Fotos: migration `000045_create_inspection_photos`, repositório e service (tipo conferido por bytes, 10 MB, 10 por item, só em `DRAFT`, armazenamento por organização), rotas de upload, remoção e leitura autenticada, com testes
- [x] 3.6 Criar `backend/internal/inspection/CLAUDE.md`, ADR em `docs/decisions/inspection/` (unicidade por tipo, imutabilidade após conclusão, fotos em tabela própria) e linha na tabela de módulos do `CLAUDE.md` raiz
- [x] 3.7 Rodar `make test-backend` e `make test-backend-integration` sem falhas

## 4. Frontend: base

- [x] 4.1 Adicionar com a CLI do shadcn os componentes faltantes (`tabs`, `accordion`) em `src/components/ui/`
- [x] 4.2 Criar schemas Zod de laudo e item em `src/lib/inspection-schemas.ts`
- [x] 4.3 Criar cliente e server actions da Go API para laudos (`src/app/inspections/actions.ts`), tratando token e erros 404/409/422
- [x] 4.4 Definir a rota (`/inspections`) seguindo o padrão das telas migradas e incluir o item no `Sidebar`

## 5. Frontend: telas

- [x] 5.1 Lista de laudos com filtros por contrato, tipo e status, com estados de carregamento, vazio e erro
- [x] 5.2 Formulário de criação (contrato, tipo, data, observações, `copy_from_entry` para saída) com react-hook-form + Zod
- [x] 5.3 Detalhe e edição: itens agrupados por ambiente, sugestão de ambientes comuns, condição por `Select`/`Badge`
- [x] 5.4 Upload e exibição de fotos por item (rota proxy autenticada para as imagens), com limites de 10 MB e 10 fotos e mensagem de erro clara
- [x] 5.5 Ação "Concluir" com confirmação (`alert-dialog`) e modo somente leitura após conclusão
- [x] 5.6 Tela de comparação entrada × saída com itens piorados em destaque
- [x] 5.7 Atalho para laudos no detalhe do contrato (`/leases/[id]`), lendo contratos pela Go API

## 6. Verificação

- [x] 6.1 `make frontend-lint` e build do frontend sem erros
- [x] 6.2 Percorrer o fluxo no navegador (criar entrada, concluir, criar saída copiando, comparar)
- [x] 6.3 Atualizar `.claude/rules/domain-model.md` (hierarquia com Inspection e filtro por `organization_id`, ref. ADR rbac-0002)
- [x] 6.4 `openspec validate add-laudo-vistoria` sem erros

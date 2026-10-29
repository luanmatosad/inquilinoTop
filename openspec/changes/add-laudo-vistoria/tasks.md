## 1. Banco de dados

- [ ] 1.1 Escrever `000043_create_inspections.up/down.sql` (tabela, FKs, CHECK de `type` e `status`, índice único parcial `(lease_id, type) WHERE is_active`)
- [ ] 1.2 Escrever `000044_create_inspection_items.up/down.sql` (CHECK de `condition`, índice por `inspection_id`)
- [ ] 1.3 Aplicar e reverter as migrations no Postgres de testes (`:5433`) sem erro

## 2. Backend: modelo e testes (TDD)

- [ ] 2.1 Criar `internal/inspection/model.go` com tipos, enums, inputs com `validate` e a interface `Repository`
- [ ] 2.2 Escrever `service_test.go` com mock local cobrindo: criação, contrato de outra organização, duplicidade por tipo, edição de laudo concluído, conclusão sem itens, cópia da entrada, comparação
- [ ] 2.3 Implementar `service.go` até os testes passarem (`LeaseReader` por interface, erros com `errors.Is` e wrapping `inspection.svc:`)
- [ ] 2.4 Escrever `repository_test.go` de integração com helper `testDB` (filtro por `organization_id`, soft-delete, unicidade parcial)
- [ ] 2.5 Implementar `repository.go` (`pgRepository`, `inspection.repo:`), itens sempre via join com a organização
- [ ] 2.6 Registrar criar e concluir laudo no `audit`

## 3. Backend: API

- [ ] 3.1 Escrever `handler_test.go` (UUID inválido, body inválido, 404, 409 `INSPECTION_NOT_EDITABLE`, lista `[]`)
- [ ] 3.2 Implementar `handler.go` com rotas de `/api/v1/inspections`, itens, `complete` e `GET /api/v1/leases/{id}/inspections/compare`, `authMW` por rota e permissão RBAC
- [ ] 3.3 Adicionar annotations Swagger completas e rodar `swag init`
- [ ] 3.4 Compor repositório, service e handler em `cmd/api/main.go`
- [ ] 3.5 Estender `document` para aceitar `entity_type=inspection_item` (validação e checagem de propriedade pela organização) com testes
- [ ] 3.6 Criar `backend/internal/inspection/CLAUDE.md`, ADR em `docs/decisions/inspection/` (unicidade por tipo, imutabilidade após conclusão) e linha na tabela de módulos do `CLAUDE.md` raiz
- [ ] 3.7 Rodar `make test-backend` e `make test-backend-integration` sem falhas

## 4. Frontend: base

- [ ] 4.1 Adicionar com a CLI do shadcn os componentes faltantes (`tabs`, `accordion`, `sheet`) em `src/components/ui/`
- [ ] 4.2 Criar schemas Zod de laudo e item em `src/lib/schemas.ts`
- [ ] 4.3 Criar cliente e server actions da Go API para laudos (`src/app/owner/inspections/actions.ts`), tratando token e erros 404/409/422
- [ ] 4.4 Definir a rota (`/owner/inspections` ou `/inspections`) seguindo o padrão das telas migradas e incluir o item no `Sidebar`

## 5. Frontend: telas

- [ ] 5.1 Lista de laudos com filtros por contrato, tipo e status, com estados de carregamento, vazio e erro
- [ ] 5.2 Formulário de criação (contrato, tipo, data, observações, `copy_from_entry` para saída) com react-hook-form + Zod
- [ ] 5.3 Detalhe e edição: itens agrupados por ambiente, sugestão de ambientes comuns, condição por `Select`/`Badge`
- [ ] 5.4 Upload e exibição de fotos por item, com limite de 10 MB e mensagem de erro clara
- [ ] 5.5 Ação "Concluir" com confirmação (`alert-dialog`) e modo somente leitura após conclusão
- [ ] 5.6 Tela de comparação entrada × saída com itens piorados em destaque
- [ ] 5.7 Atalho para laudos a partir do contrato (`LeaseForm`/`ActiveLeaseCard`), lendo contratos pela fonte atual com `// TODO: migrar para Go API`

## 6. Verificação

- [ ] 6.1 `make frontend-lint` e build do frontend sem erros
- [ ] 6.2 Percorrer o fluxo no navegador (criar entrada, concluir, criar saída copiando, comparar)
- [ ] 6.3 Atualizar `.claude/rules/domain-model.md` (hierarquia com Inspection e filtro por `organization_id`, ref. ADR rbac-0002)
- [ ] 6.4 `openspec validate add-laudo-vistoria` sem erros

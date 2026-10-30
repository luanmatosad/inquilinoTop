## Why

Proprietários não têm como registrar o estado do imóvel na entrada e na saída do inquilino, que é a principal prova em disputas de caução e danos. O mapeamento da Rentila (`mapeamento_saas.md`) mostra "Laudo de vistoria" como funcionalidade central do concorrente, ausente no domínio Go.

## What Changes

- Novo domínio Go `inspection` (4 arquivos padrão) com laudos de **entrada** e **saída** vinculados a um `lease`.
- Laudo com ambientes e itens (estado, observações) e fotos (JPEG, PNG ou WebP) por item.
- Laudo de saída pode ser comparado com o de entrada do mesmo contrato.
- Ciclo do laudo: `DRAFT` → `COMPLETED`. Concluído fica somente leitura.
- Migrations `inspections`, `inspection_items` e `inspection_photos`, com soft-delete e `organization_id`.
- Fotos em tabela própria (`inspection_photos`), sem alterar o módulo `document`.
- Frontend: telas de laudo (lista, criação/edição, detalhe, comparação) usando apenas componentes shadcn/ui, consumindo a Go API (sem Supabase novo).
- **BREAKING**: nenhum. A limpeza de HeroUI e a adoção formal do shadcn/ui ficam na change `cleanup-heroui`, que deve entrar antes.

## Capabilities

### New Capabilities
- `inspection-reports`: laudos de vistoria de entrada e saída por contrato, com itens, fotos, conclusão e comparação.

### Modified Capabilities
<!-- Nenhum spec existente em openspec/specs/ (só login-screen) tem requisito alterado. -->

## Impact

- **Backend**: novo `backend/internal/inspection/` (`model.go`, `repository.go`, `service.go`, `handler.go` + testes), migrations `000043`, `000044` e `000045`, registro em `cmd/api/main.go`, anotações Swagger; o módulo `document` não muda.
- **API**: `/api/v1/inspections` (CRUD, `complete`, `compare`), itens aninhados.
- **Frontend**: novas rotas sob `src/app/owner/` (ou `inspections/`), componentes em `src/components/inspections/`, cliente Go API, schemas Zod em `src/lib/schemas.ts`. Componentes shadcn adicionais conforme necessário (`tabs`, `accordion`, `sheet`).
- **Docs/rules**: atualizar `.claude/rules/domain-model.md` (hierarquia ganha Inspection; filtro por `organization_id`, ver ADR rbac-0002).
- **Fora de escopo**: assinatura eletrônica do laudo, modelos de laudo customizáveis, PDF, inventário de móveis e portal do inquilino.

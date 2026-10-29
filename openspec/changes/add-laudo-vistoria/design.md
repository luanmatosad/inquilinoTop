## Context

- Go já tem `lease` (Tenant ↔ Unit), `document` (upload por `entity_type`/`entity_id`) e o padrão de 4 arquivos por domínio. Não há registro do estado do imóvel.
- Rentila modela laudo como entidade ligada a imóvel e inquilino, com tipo entrada/saída e estado rascunho (ver `mapeamento_saas.md`). Lá, um laudo pode existir sem imóvel; aqui exigimos contrato.
- Domínios novos usam `organization_id` (ADR rbac-0002). `.claude/rules/domain-model.md` ainda fala em `owner_id` e está desatualizado.
- Frontend: `components/ui/` é shadcn. A limpeza de HeroUI vive na change `cleanup-heroui`, pré-requisito desta.
- Domínios property/tenant/lease ainda estão no Supabase no frontend. Laudo precisa listar contratos e unidades; isso exige ler esses dados sem criar lógica Supabase nova.

## Goals / Non-Goals

**Goals:**
- Registrar laudo de entrada e de saída por contrato, com ambientes, itens, estado e fotos.
- Comparar saída com entrada para apoiar decisão sobre caução.
- Entregar a UI só com componentes shadcn/ui.

**Non-Goals:**
- Assinatura eletrônica, PDF, modelos customizáveis de laudo, inventário de móveis, aceite pelo inquilino.
- Migrar property/tenant/lease do frontend para Go (outra change).
- Reescrever visual das telas existentes.

## Decisions

### D1. Domínio `inspection` separado de `lease`
Pacote próprio com `model.go`, `repository.go`, `service.go`, `handler.go`. Alternativa: campos dentro de `lease`. Rejeitada: um contrato tem vários laudos, o ciclo de vida é distinto e violaria SRP. Dependência de `lease` entra por interface (`LeaseReader`, no padrão de `payment`).

### D2. Modelo de dados

```
inspections
  id uuid PK, organization_id uuid NOT NULL, lease_id uuid NOT NULL FK,
  type  ENTRY | EXIT, status DRAFT | COMPLETED,
  inspected_at date NOT NULL, general_notes text,
  completed_at timestamptz, is_active bool, created_at, updated_at
  UNIQUE parcial (lease_id, type) WHERE is_active  -- 1 entrada e 1 saída ativas por contrato

inspection_items
  id uuid PK, inspection_id uuid FK, room varchar(100), item varchar(150),
  condition GOOD | FAIR | POOR | DAMAGED | NOT_APPLICABLE,
  notes text, position int, is_active bool, created_at, updated_at
```

- `organization_id` em `inspections`; itens herdam via `inspection_id` e toda query faz join com a organização (nunca confiar só no id do item).
- Soft-delete em ambas (ADR cross-cutting-0001).
- Fotos: reaproveitar `documents` com `entity_type='inspection_item'` e `entity_id` do item. Evita nova tabela e storage. Alternativa: tabela `inspection_photos`. Rejeitada por duplicar `document`.
- Ambiente é só texto em `room`; sem tabela de ambientes. Mais simples; agrupamento na UI por `room`.

### D3. Regras
- Criar laudo exige contrato da organização. `EXIT` exige `ENTRY` ativo no mesmo contrato? Não: saída sem entrada é permitida (contratos antigos), mas `compare` retorna 409 se faltar um dos dois.
- Só `DRAFT` aceita edição de itens e dados. `COMPLETED` é imutável; correção exige novo laudo (exclui o anterior por soft-delete antes).
- `complete` exige ao menos 1 item.
- Itens podem ser pré-preenchidos na criação de `EXIT` copiando os de `ENTRY` (flag `copy_from_entry`), com condição a reavaliar.
- `compare` retorna pares por `(room, item)`: condição de entrada, de saída e `worsened` (boolean) quando a saída é pior na ordem GOOD < FAIR < POOR < DAMAGED. Itens só de um lado aparecem com o outro nulo.

### D4. API (todas com `authMW`, swagger obrigatório)

| Método | Rota |
|---|---|
| GET/POST | `/api/v1/inspections` (filtro `lease_id`, `type`, `status`) |
| GET/PUT/DELETE | `/api/v1/inspections/{id}` |
| POST | `/api/v1/inspections/{id}/complete` |
| GET | `/api/v1/leases/{id}/inspections/compare` |
| POST | `/api/v1/inspections/{id}/items` |
| PUT/DELETE | `/api/v1/inspections/{id}/items/{itemId}` |

Códigos de erro SNAKE_CASE. Listas nunca nil. Estado inválido → 409 `INSPECTION_NOT_EDITABLE`.

### D5. RBAC e auditoria
Reusar o middleware de permissão existente do `rbac`. Criar e concluir laudo geram `audit_logs`. Escopo por `organization_id`, mesmo padrão dos outros domínios.

### D6. Frontend: shadcn only, Go API
- Telas: lista de laudos, formulário (react-hook-form + Zod), detalhe com itens agrupados por ambiente, comparação lado a lado, upload de fotos.
- Componentes: Card, Table, Dialog, Select, Badge, Tabs e Accordion de shadcn; adicionar via CLI (`shadcn add`). Sem biblioteca extra.
- Dados de laudo vêm da Go API via server actions (regra do `.claude/rules/frontend.md`). Lista de contratos e unidades usa a leitura atual (Supabase), marcada `// TODO: migrar para Go API`, sem criar lógica nova.
- Guardrail de lint contra `@heroui/*` vem de `cleanup-heroui`.

## Risks / Trade-offs

- [Muitas fotos por laudo estouram o limite de 10 MB do `document`] → Limite por arquivo mantido; UI limita quantidade e mostra erro claro. Compressão no cliente fica para depois.
- [Itens de texto livre dificultam comparação] → Chave `(room, item)` normalizada (trim, case-insensitive); cópia da entrada para a saída mantém os nomes.
- [Laudo concluído imutável pode frustrar correção] → Fluxo de exclusão e novo laudo documentado; reabertura fica fora do escopo.
- [Frontend lê contratos no Supabase] → Dívida explícita e marcada; troca quando `lease` migrar.

## Migration Plan

1. Migrations `000042_create_inspections` e `000043_create_inspection_items`, com `down` reversível.
2. Backend e testes; documento aceita `inspection_item`.
3. Frontend por trás de rota nova, sem alterar telas existentes.
4. Rollback: reverter migrations (tabelas novas, sem dados legados) e remover rotas.

## Open Questions

- Laudo de saída deve bloquear o `end` do contrato até ser concluído? Proposta: não bloquear, só avisar na UI.
- Ambientes pré-definidos (sala, cozinha, banheiro) como sugestão no formulário? Proposta: sim, lista estática no frontend.
- Rotas do frontend: `/owner/inspections` (padrão `owner/*`) ou `/inspections`? Seguir o que as demais telas migradas usarem; decidir no início da tarefa de frontend.

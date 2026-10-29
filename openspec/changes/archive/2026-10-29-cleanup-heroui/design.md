## Context

- `components/ui/` é shadcn. HeroUI foi removido de `package.json` e `src/`, mas a alteração está só na working tree (junto com muitas outras mudanças de frontend).
- Resíduos conhecidos: `docs/frontend/**` (DESIGN.md, code.html), `design_handoff_financial_dashboard/`, `openspec/changes/migrate-frontend-to-heroui` (ativa, obsoleta), `openspec/changes/implement-frontend-support` ("HeroUI-like") e a change arquivada `2026-10-17-migrate-shadcn-ui-kit` (histórico, não mexer).
- `.claude/rules/frontend.md` ainda diz Next.js 15; o projeto está no 16.

## Goals / Non-Goals

**Goals:**
- Nenhuma dependência, import ou instrução ativa a HeroUI.
- Guardrail automático contra reintrodução.
- Decisão registrada em ADR.

**Non-Goals:**
- Refazer visual de telas ou mocks do Stitch.
- Mexer em changes já arquivadas.
- Migrar dados de property/tenant/lease para Go (outras changes).

## Decisions

### D1. Isolar a remoção num commit próprio
A remoção do HeroUI está misturada com outras alterações não commitadas. Commitar só os arquivos da remoção (`frontend/package.json`, `package-lock.json`, `next.config.ts`, arquivos de `src/` tocados pela troca) antes do resto, para o diff da limpeza ser revisável. Antes, conferir com `git diff` quais arquivos pertencem à troca; o que não for dela fica de fora.

### D2. Arquivar a change obsoleta como descartada
`migrate-frontend-to-heroui` não tem delta de spec que valha sincronizar. Arquivar com `--skip-specs` mantém o histórico sem poluir `openspec/specs/`.

### D3. Docs: trocar só o nome
Em `DESIGN.md`, `code.html` e handoff, substituir a referência por "shadcn/ui" onde ela instruir uso da biblioteca. Mocks do Stitch são histórico: sem refazer layout, sem remover arquivos.

### D4. Guardrail por ESLint
`no-restricted-imports` com padrão `@heroui/*` e mensagem apontando o ADR. Alternativa: script de CI com grep. Rejeitada: o lint já roda em `make frontend-lint` e dá feedback no editor.

### D5. ADR
`docs/decisions/_cross-cutting/0002-shadcn-ui-unica-biblioteca.md` seguindo o template de `docs/decisions/README.md`, indexado no README e linkado em `frontend/CLAUDE.md`.

## Risks / Trade-offs

- [Commitar a remoção arrasta arquivos alheios] → Conferir `git status`/`git diff` por arquivo e usar `git add` seletivo.
- [Substituição textual em `code.html` quebra marcação] → Editar só texto/comentários que citam a biblioteca; abrir o arquivo para conferir.
- [Lint novo acusa falso positivo] → Padrão restrito a `@heroui/*`; rodar `make frontend-lint` antes e depois.

## Migration Plan

1. Commit isolado da remoção.
2. Arquivar change obsoleta e editar docs/regras.
3. Lint + ADR.
4. Rollback: reverter os commits; nada em runtime muda.

## Open Questions

- Nenhuma.

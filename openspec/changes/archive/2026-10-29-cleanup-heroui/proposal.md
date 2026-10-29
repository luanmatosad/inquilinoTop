## Why

HeroUI já saiu de `frontend/package.json` e de `frontend/src/` (alteração ainda não commitada), mas sobram resíduos em changes abertas, docs de design e regras, e nada impede a volta da biblioteca. A change `migrate-frontend-to-heroui` (57 tarefas concluídas) descreve um estado que não existe mais e confunde quem lê `openspec list`. Fechar a migração para shadcn/ui antes das features do MVP evita que telas novas nasçam com a biblioteca errada.

## What Changes

- Commitar a remoção atual de `@heroui/*` para isolar a limpeza.
- Arquivar `migrate-frontend-to-heroui` como descartada, sem sincronizar specs.
- Trocar HeroUI por shadcn/ui em `implement-frontend-support`, `docs/frontend/**` e `design_handoff_financial_dashboard/` (só o nome da biblioteca; layouts ficam).
- Atualizar `.claude/rules/frontend.md` (Next.js 15 → 16) e `frontend/CLAUDE.md` onde citarem a biblioteca antiga.
- Regra ESLint `no-restricted-imports` para `@heroui/*`, validada por `make frontend-lint`.
- ADR registrando shadcn/ui como única biblioteca de UI.
- **BREAKING**: nenhum.

## Capabilities

### New Capabilities
- `frontend-shadcn-only`: o frontend usa shadcn/ui como única biblioteca de componentes; nenhuma dependência ou referência ativa a HeroUI.

### Modified Capabilities
<!-- Nenhum spec existente em openspec/specs/ tem requisito alterado. -->

## Impact

- **Frontend**: `eslint.config.*`, `package.json`/`package-lock.json` (apenas commit do que já foi removido).
- **Docs/openspec**: arquivar `migrate-frontend-to-heroui`; editar `implement-frontend-support`, `docs/frontend/**`, `design_handoff_financial_dashboard/`, `.claude/rules/frontend.md`, `frontend/CLAUDE.md`; novo ADR em `docs/decisions/_cross-cutting/`.
- **Sem backend, sem migrations.**
- **Relação com outras changes**: independente; deve entrar antes de `mvp-cadastros`, `mvp-contratos`, `mvp-contas-pagar-receber` e `add-laudo-vistoria` para que as telas novas já tenham o guardrail.

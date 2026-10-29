## 1. Isolar e verificar a remoção

- [ ] 1.1 Revisar `git status`/`git diff` e commitar só os arquivos da remoção de `@heroui/*` (`package.json`, `package-lock.json`, `next.config.ts`, arquivos de `src/` da troca), deixando o resto fora
- [x] 1.2 Confirmar `grep -rIi heroui frontend/src frontend/package*.json frontend/next.config.ts` sem resultados e `frontend/node_modules/@heroui` ausente

## 2. Resíduos em openspec, docs e regras

- [x] 2.1 Arquivar `openspec/changes/migrate-frontend-to-heroui` como descartada (sem sincronizar specs)
- [x] 2.2 Remover a menção "HeroUI-like" em `openspec/changes/implement-frontend-support/{proposal,design}.md`
- [x] 2.3 Trocar HeroUI por shadcn/ui em `docs/frontend/**/DESIGN.md`, `docs/frontend/**/code.html` e `design_handoff_financial_dashboard/` (apenas o nome da biblioteca)
- [x] 2.4 Atualizar `.claude/rules/frontend.md` (Next.js 15 → 16) e `frontend/CLAUDE.md` se citarem a biblioteca antiga

## 3. Guardrail e decisão

- [x] 3.1 Adicionar regra ESLint `no-restricted-imports` para `@heroui/*` e validar com `make frontend-lint` (falha com import de teste, passa sem)
- [x] 3.2 Criar ADR `docs/decisions/_cross-cutting/0002-shadcn-ui-unica-biblioteca.md`, indexar no `README.md` e linkar em `frontend/CLAUDE.md`

## 4. Verificação

- [x] 4.1 `make frontend-lint` e build do frontend sem erros
- [x] 4.2 `grep -rIil heroui` fora de `openspec/changes/archive/` e do próprio ADR sem resultados
- [x] 4.3 `openspec validate cleanup-heroui` sem erros

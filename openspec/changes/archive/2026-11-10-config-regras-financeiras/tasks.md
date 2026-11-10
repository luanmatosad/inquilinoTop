## 1. Backend (`internal/settings`)

- [x] 1.1 Migration 000052 (`organization_settings` com CHECKs e cópia segura de `default_late_fee`/`default_interest`) e down
- [x] 1.2 TDD service: padrões sem linha, validação das faixas (multa, juros, índice, aviso), upsert
- [x] 1.3 Repositório (integração): ler e gravar por organização, isolamento, migration copiando valor válido e ignorando inválido
- [x] 1.4 Handler `GET/PUT /settings/financial-rules` (`org:read` e `org:update`), 400 `INVALID_RULES`, Swagger, teste de handler
- [x] 1.5 Ligação em `cmd/api/main.go` e `backend/internal/settings/CLAUDE.md`

## 2. Frontend

- [x] 2.1 `lib/financial-rules.ts` (padrões, faixas e schema Zod, mapeamento de erro) com TDD
- [x] 2.2 `/settings/rules` com a action de salvar; "Regras financeiras" com link no menu (`settings-nav`) e testes de nav
- [x] 2.3 Novo contrato usa os padrões (`app/leases/page.tsx`, `LeaseFormSheet`, `LeaseForm`), sem mudar a edição
- [x] 2.4 Hoje: janela do reajuste vem das regras (`buildToday`, `app/page.tsx`), padrão 60 se falhar
- [x] 2.5 Recebimento (Pix): remove o bloco "Padrões de Cobrança" do formulário e da action
- [x] 2.6 Testes de tela, action, contrato novo e Hoje

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), specs sincronizadas no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador: abrir as regras, novo contrato com os padrões e Hoje

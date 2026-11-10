## 1. Backend (`internal/settings`)

- [x] 1.1 Migration 000054 (`reminder_templates` com índice único parcial `(organization_id, offset_days)` ativo) e down
- [x] 1.2 TDD `reminders.go` (padrões, variáveis conhecidas, validação de lista, nome, dias e texto)
- [x] 1.3 TDD service: listar (padrões sem linhas) e substituir a lista (valida antes de gravar)
- [x] 1.4 Repositório (integração): lista ativa ordenada, substituição desativa e cria, dias únicos no banco, isolamento por organização
- [x] 1.5 Handler `GET/PUT /settings/reminders` (`org:read` e `org:update`), 400 `INVALID_REMINDERS`, Swagger e testes
- [x] 1.6 `CLAUDE.md` do settings

## 2. Frontend

- [x] 2.1 `lib/message-templates.ts` (variáveis, `renderTemplate`, `pickReminder`, rótulo dos dias, validação espelhada, dados de exemplo) com TDD
- [x] 2.2 `/settings/messages`: lista, "Adicionar lembrete" e painel com variáveis, prévia e remover
- [x] 2.3 Detalhe da cobrança escolhe o modelo e o `SendChargeDialog` o usa, com texto fixo de reserva
- [x] 2.4 Menu "Mensagens e cobrança" com link e testes de navegação
- [x] 2.5 Testes de tela, action, escolha do modelo e diálogo

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), specs sincronizadas no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador (só leitura): tela de mensagens e o diálogo de envio

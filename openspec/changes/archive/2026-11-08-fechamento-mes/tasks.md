## 1. Backend (`internal/closing`)

- [x] 1.1 Migration 000051 (`month_closings` com índice único parcial ativo, `month_closing_events`) e down
- [x] 1.2 TDD service: validação do mês (formato, só passado), retrato (previsto, recebido, em atraso, pendências, recibos) com leitor de cobranças por interface
- [x] 1.3 TDD service: fechar (409 se fechado), reabrir (motivo obrigatório, 409 se aberto), fechar de novo após reabrir, histórico
- [x] 1.4 Repositório (integração): gravar, buscar ativo, reabrir sem DELETE, eventos, isolamento por organização
- [x] 1.5 Handler (`GET /closings`, `POST /closings`, `POST /closings/{month}/reopen`) com Swagger e teste de handler
- [x] 1.6 Ligação em `cmd/api/main.go` (leitor de cobranças e de perfil) e `backend/internal/closing/CLAUDE.md`

## 2. Frontend

- [x] 2.1 `lib/month-closing.ts` (regras puras: mês passado, textos, "com N pendência(s)") com TDD
- [x] 2.2 Página `/financial/receivables/fechamento` (conferir e fechado, degradação) e server actions `closeMonth`/`reopenMonth`
- [x] 2.3 Diálogos Fechar (confirmar) e Reabrir (motivo), resumo em PDF por impressão
- [x] 2.4 Recebimentos: botão **Fechar {mês}** e selo **Mês fechado** só em meses passados
- [x] 2.5 Testes de página e componentes

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), spec sincronizada no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador: fechar mês com pendência, ver fechado, reabrir

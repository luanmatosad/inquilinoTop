## 1. Backend (`internal/report`)

- [x] 1.1 TDD service: ano válido, meses completos (corrente, passado, janeiro, futuro), série com meses zerados e totais
- [x] 1.2 Repositório (integração): recebido por `paid_date` e líquido, despesas pagas por `paid_date`, por unidade, isolamento por organização
- [x] 1.3 Handler (`GET /reports/overview`, `GET /reports/by-property`) com Swagger e teste de handler
- [x] 1.4 Ligação em `cmd/api/main.go` e `backend/internal/report/CLAUDE.md`

## 2. Frontend

- [x] 2.1 `lib/report-overview.ts` (ano, rótulo do período, linhas por imóvel com rótulos, CSV) com TDD
- [x] 2.2 Hub `/reports`: seletor de ano, indicadores, gráfico mensal, cards e falha
- [x] 2.3 `/reports/por-imovel`: tabela com total, cards no celular, falha de imóveis
- [x] 2.4 Rota `GET /api/reports/por-imovel` (CSV) e botão Exportar planilha
- [x] 2.5 Testes de página e da rota

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), specs sincronizadas no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador: hub, trocar de ano, Por imóvel, CSV

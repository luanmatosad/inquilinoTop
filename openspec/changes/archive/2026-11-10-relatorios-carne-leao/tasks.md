## 1. Backend (`internal/report`)

- [x] 1.1 TDD service: mês válido e encerrado, base (nunca negativa), prazo (último dia útil do mês seguinte, incluindo virada de ano e fim de semana)
- [x] 1.2 Repositório (integração): rendimentos só de PF por `paid_date` e líquido, despesas só das categorias que entram, isolamento por organização
- [x] 1.3 Handler `GET /reports/carne-leao` (400, 422, 401) com Swagger e teste
- [x] 1.4 `backend/internal/report/CLAUDE.md` atualizado

## 2. Frontend

- [x] 2.1 `lib/carne-leao.ts` (mês padrão e limites, navegação, rótulos, faixa de estado, CSV) com TDD
- [x] 2.2 Página `/reports/carne-leao`: faixa, totais, listas, navegação de mês, falha e vazio
- [x] 2.3 Rota `GET /api/reports/carne-leao` (CSV) e botões Baixar para o contador e Exportar planilha
- [x] 2.4 Card Carnê-leão e DIRPF no hub
- [x] 2.5 Testes de página, da rota e do hub

## 3. Fechamento

- [x] 3.1 CLAUDE.md (backend e frontend), spec sincronizada no arquivamento
- [x] 3.2 Suítes (backend `-p 1`, frontend), `tsc` e lint
- [x] 3.3 Percurso no navegador: abrir o mês, trocar de mês, planilha e impressão

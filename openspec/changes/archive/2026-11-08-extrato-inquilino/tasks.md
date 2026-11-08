## 1. Regras puras (`lib/tenant-statement.ts`)

- [x] 1.1 TDD: período (12 meses, ano, personalizado, inválido e invertido) em São Paulo
- [x] 1.2 TDD: situação da linha e valor exibido (paga em dia, paga com atraso, atrasada, aguardando, prevista)
- [x] 1.3 TDD: indicadores (recebido, pontualidade, atrasos e em atraso agora com dias e mês)
- [x] 1.4 TDD: reajustes, acordos e cobrança aberta mais antiga (para o Cobrar)
- [x] 1.5 TDD: linhas visíveis (seis mais recentes, "Mostrando N dos M", ver todos)

## 2. Tela

- [x] 2.1 `TenantTabs` (Resumo e Extrato) e uso no detalhe atual, sem mudar o Resumo
- [x] 2.2 `app/tenants/[id]/extrato/page.tsx`: buscas em paralelo, cabeçalho, degradação e sem contrato
- [x] 2.3 Indicadores, filtro de período (chips e formulário Personalizado) e tabela/cards
- [x] 2.4 Cartões Contrato, Reajustes e Acordos
- [x] 2.5 Exportar PDF (impressão) e Cobrar
- [x] 2.6 Testes de página (em dia, com atraso, sem contrato, período, degradação, ver todos)

## 3. Fechamento

- [x] 3.1 `frontend/CLAUDE.md` (rota do extrato) e spec sincronizada no arquivamento
- [x] 3.2 Suíte do frontend, `tsc` e lint
- [x] 3.3 Percurso no navegador (desktop e celular): em dia, com atraso, filtros e Exportar PDF

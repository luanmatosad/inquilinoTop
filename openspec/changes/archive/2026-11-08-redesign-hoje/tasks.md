## 1. Regras puras (`lib/today-overview.ts`)

- [x] 1.1 TDD: saudação por hora e data por extenso em São Paulo; frase de contagem (0, 1, N)
- [x] 1.2 TDD: listas Confirmar, Atrasados e Para cobrar (janela de 7 dias, prioridade do aviso, ordenação, textos de dias)
- [x] 1.3 TDD: Fique de olho (reajuste pendente ou em 30 dias; término em 60 dias) e contagem total
- [x] 1.4 TDD: indicadores (Previsto, Recebido com percentual, Em atraso com "a mais antiga há N dias") iguais aos de Recebimentos
- [x] 1.5 TDD: checklist de primeiros passos (progresso, passo bloqueado, conta nova = sem contrato)

## 2. Tela

- [x] 2.1 Componentes em `components/today/`: cabeçalho, KPIs, cartão de lista e linha (desktop e celular)
- [x] 2.2 Lista Confirmar pagamento com `ConfirmReportDialog` e estado vazio
- [x] 2.3 Listas Atrasados e Para cobrar com links `?enviar=1`; Fique de olho com `?reajustar=1` e `/leases/{id}`
- [x] 2.4 `app/page.tsx` com as buscas em paralelo, erro com "Tentar novamente" e degradação
- [x] 2.5 Conta nova: Primeiros passos, cartão Importar planilha e KPIs zerados
- [x] 2.6 Testes de página (dia com pendências, vazio, erro, degradação, conta nova)

## 3. Limpeza e fechamento

- [x] 3.1 Remover `components/dashboard/*`, `data/dashboard/*` e `dashboardMapper.test.ts`; conferir que nada mais os importa
- [x] 3.2 `frontend/CLAUDE.md` (rota `/` = Hoje) e `backend/internal/dashboard/CLAUDE.md` (sem consumidor no frontend)
- [x] 3.3 Suíte do frontend, `tsc` e lint
- [x] 3.4 Percurso no navegador (só leitura, desktop, sessão real do dono): saudação, indicadores, Confirmar vazio e Atrasados. Fica com o dono: celular em 390px, confirmar um aviso e a conta nova (só com teste automatizado)

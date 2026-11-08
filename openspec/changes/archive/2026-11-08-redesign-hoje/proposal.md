## Why

A home (`/`) ainda é o painel antigo: números soltos (`StatsCards`, `FinancialSummary`, `RecentActivity`) sem nenhuma ação. O canvas redesenhou a seção 03 como **Hoje**: o que confirmar, cobrar e resolver, com os mesmos botões de Recebimentos. Com o link público e o aviso "já paguei" prontos, é nela que o dono vê que um inquilino avisou e confirma em um toque.

## What Changes

- Home `/` vira **Hoje**: saudação por hora, data, "Você tem N coisas para resolver hoje.", indicadores Previsto, Recebido (com barra) e Em atraso, e as listas **Confirmar pagamento**, **Atrasados**, **Para cobrar** e **Fique de olho** (reajuste a aprovar e contrato terminando). Desktop e celular.
- Confirmar abre o diálogo que já existe em Recebimentos; Cobrar e Enviar cobrança levam ao detalhe com o envio aberto (`?enviar=1`); Revisar reajuste leva ao contrato com o painel aberto (`?reajustar=1`).
- Conta nova (nenhum contrato): em vez das listas, **Primeiros passos** (5 passos derivados das contagens e da chave Pix) e o cartão "Importar planilha".
- Função pura `src/lib/today-overview.ts` (listas, contagem, saudação, janelas) com a junção feita no servidor Next, como em Recebimentos.
- **BREAKING (UI):** saem `StatsCards`, `FinancialSummary`, `RecentActivity`, `DashboardSkeleton`, `data/dashboard` e o `dashboardMapper.test`. O endpoint `GET /dashboard/metrics` continua no backend, sem consumidor no frontend por enquanto.
- Fora desta etapa: sino de notificações (seção 05), percentual do reajuste (precisa alimentar `index_values`), onboarding completo (seção 02, "a decidir"), Exportar.

## Capabilities

### New Capabilities
- `today-overview`: listas, contagem, janelas, saudação e ações da tela Hoje.
- `getting-started`: checklist de primeiros passos da conta nova.

### Modified Capabilities
<!-- nenhuma: a navegação (Hoje em `/`) já está em app-shell-navigation -->

## Impact

- Frontend: `app/page.tsx`, novos `components/today/*`, `lib/today-overview.ts`, testes; remoção de `components/dashboard/*`, `data/dashboard/*` e `__tests__/dashboardMapper.test.ts`; reaproveita `ConfirmReportDialog`, `ReportInfo`, `isReadjustmentPending`/`todaySaoPaulo` (`lib/lease-overview.ts`).
- Sem backend, sem migration, sem dependência nova.

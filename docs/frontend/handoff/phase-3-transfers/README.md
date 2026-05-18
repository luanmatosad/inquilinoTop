# Phase 3 — `/financial/transfers` (tela nova)

**Status:** ✅ Pronto pra dev
**Branch sugerida:** `feat/transfers`
**Branch base:** `main` após Phase 1 (depende de `_shared/` e `StatusBadge` estendido — `SCHEDULED` da Phase 2 ajuda mas não é bloqueante)
**Mock de referência:** `../../Repasses.html` · fonte JSX `../../TransfersScreen.jsx`

## O que esta fase faz

Tela de **Repasses ao proprietário** — pagamento líquido mensal que a imobiliária faz a cada owner após descontar taxa adm, retenções e despesas. Single-screen, sem tabs.

### Anatomia

- **Header**: H1 "Repasses", caption + CTA `Processar repasses do mês`
- **Banner de resumo**: total líquido do mês em destaque + ações `Exportar CNAB` e `Ver histórico`
- **Tabela**: 1 linha por proprietário com bruto, deduções e líquido lado a lado
- **Modal de extrato**: click em "Ver extrato" abre Dialog com a decomposição linha-a-linha de UM proprietário

### Status de repasse (sem SCHEDULED — usar paleta existente)

| Status     | Badge          | Label        | Significado                            |
|------------|----------------|--------------|----------------------------------------|
| `PENDING`  | warning        | Aguardando   | A imobiliária ainda não aprovou        |
| `APPROVED` | info (`REVIEW`)| Aprovado     | Aprovado, aguardando agendamento bancário |
| `SENT`     | success (`PAID`)| Enviado     | Transferência efetivada                |

## Dependências

| Item                          | Origem                          |
|-------------------------------|---------------------------------|
| `StatusBadge` reutilizado     | `@/components/ui/status-badge`  |
| `TableSkeleton`, `ErrorState`, `EmptyState`, `Spinner` | `@/components/financial/shared` (Phase 1) |
| `fmtBRL`, `fmtDate`, `fmtMonth` | `@/lib/format`                |
| `showToast.success/error/neutral` | `@/lib/sonner` (Phase 1)    |

## Arquivos a criar

| Arquivo                                                                       | Ação    |
|-------------------------------------------------------------------------------|---------|
| `frontend/src/app/financial/transfers/page.tsx`                               | criar   |
| `frontend/src/app/financial/transfers/loading.tsx`                            | criar   |
| `frontend/src/app/financial/transfers/_components/TransfersClient.tsx`        | criar   |
| `frontend/src/app/financial/transfers/_components/TransferDetailModal.tsx`    | criar   |
| `frontend/src/app/financial/actions.ts`                                       | patch   |
| `frontend/src/components/Sidebar.tsx`                                         | patch (href no item Repasses) |

## Backend (Go)

Endpoints esperados:

- `GET /api/v1/transfers?month=YYYY-MM` — lista de repasses do mês
- `POST /api/v1/transfers/{id}/approve` — aprova repasse individual
- `POST /api/v1/transfers/batch-approve` — aprova um lote (CTA do header)
- `GET /api/v1/transfers/{id}/cnab` — gera arquivo CNAB para download

Se ainda não existem: actions retornam seed-data + `TODO(api)`, mesmo padrão das fases anteriores.

## Caveats

- **CNAB** é o formato bancário brasileiro padrão para remessa de pagamentos em lote. O parser/gerador do Go ainda não foi escrito (provavelmente) — a action `exportCNAB()` pode ser stub retornando blob vazio até o backend implementar. Botão fica habilitado mesmo assim, dispara download de um placeholder.
- O CTA "Processar repasses do mês" abre um **wizard** de aprovação em lote — fora do escopo desta fase (vira `feat/transfers-wizard` na iteração 2). Por ora, o botão pode disparar `POST /api/v1/transfers/batch-approve` direto com confirmação simples (alert dialog "Aprovar todos os 4 repasses pendentes?") e mostrar toast.
- **IRRF (carnê-leão)** é a retenção fiscal por aluguel. O cálculo é regressivo por faixa — está implementado no Go (provavelmente). A tela apenas exibe.
- **IPTU retido**: alguns contratos preveem que a imobiliária paga IPTU e desconta do repasse. Coluna "Descontos" agrega `tax + iptu` para não poluir.

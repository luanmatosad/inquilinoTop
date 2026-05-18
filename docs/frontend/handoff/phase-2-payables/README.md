# Phase 2 — `/financial/payables` (tela nova)

**Status:** ✅ Pronto pra dev
**Branch sugerida:** `feat/payables`
**Branch base:** `main` após Phase 1 (`feat/receivables-states`) — porque consome `_shared/`
**Mock de referência:** `../../Contas a pagar.html`

## O que esta fase faz

Implementa a tela `/financial/payables` do zero. **Espelha intencionalmente o esqueleto de Receivables** (tabs + filtros + tabela + dropdown por row + modal) — manter os padrões reduz o custo cognitivo de quem alterna entre as duas. As diferenças são todas semânticas (saída em vez de entrada).

### Mudanças vs. Receivables

- Abas: **Fornecedores** / **Impostos & taxas** (não Aluguel/Outras)
- Status estendido: adiciona `SCHEDULED` à paleta de `StatusBadge`
- 4 cards de resumo (Pago · Agendado · A pagar · Em atraso) em vez de 3
- Linha da tabela: Beneficiário/Imóvel · Categoria · Valor · Forma · Status
- Sinal negativo opcional nos valores (toggle global, default ON)
- Ações condicionais por status (ver SPEC §6)
- Modal "Nova despesa" com 7 campos + toggle "Repassar custo ao proprietário"

## Dependências

| Item                          | Origem                          |
|-------------------------------|---------------------------------|
| `TableSkeleton`, `ErrorState`, `EmptyState`, `Spinner` | `@/components/financial/shared` (Phase 1) |
| `StatusBadge` + paleta com `SCHEDULED`                  | `@/components/ui/status-badge` (estende neste PR) |
| `fmtBRL`, `fmtDate`, `fmtMonth`                         | `@/lib/format` (já existe)        |
| `showToast.success/error/neutral`                        | `@/lib/sonner` (Phase 1)          |
| Padrão de 4 estados da tabela                           | mesma estrutura de Receivables    |
| Padrão de 4 estados do modal                            | mesma estrutura de Receivables    |

## Arquivos a criar

| Arquivo                                                                    | Ação    |
|----------------------------------------------------------------------------|---------|
| `frontend/src/app/financial/payables/page.tsx`                             | criar   |
| `frontend/src/app/financial/payables/loading.tsx`                          | criar   |
| `frontend/src/app/financial/payables/_components/PayablesClient.tsx`       | criar   |
| `frontend/src/app/financial/payables/_components/NewExpenseModal.tsx`      | criar   |
| `frontend/src/app/financial/payables/_components/PayablesTable.tsx`        | criar   |
| `frontend/src/app/financial/payables/_components/PaySummaryCards.tsx`      | criar   |
| `frontend/src/app/financial/actions.ts`                                    | patch (estende com payables actions) |
| `frontend/src/components/ui/status-badge.tsx`                              | patch (adiciona `SCHEDULED`) |
| `frontend/src/components/Sidebar.tsx`                                      | patch (item "Contas a pagar" recebe `href`) |

## Backend (Go)

A tela mock usa dados-seed. Os endpoints Go correspondentes provavelmente ainda não existem (confirmar):

- `GET /api/v1/payables?tab=vendor|tax&status=...&q=...` — lista
- `POST /api/v1/payables` — cria
- `POST /api/v1/payables/{id}/pay` — marca pago
- `POST /api/v1/payables/{id}/schedule { date }` — agenda
- `POST /api/v1/payables/{id}/cancel-schedule` — cancela agendamento

Se não existirem, abra issue paralela no repo Go e mantenha as Server Actions retornando dados-seed enquanto o backend é construído (já no padrão — `getPayables()` retorna seed array tipado como `Payable[]`).

## Caveats

- `pay()` e `schedule()` afetam saldo bancário. **Não** acione integração real no primeiro PR — stub as actions com `setTimeout(800)` simulando latência. Quando o Go integrar com PIX/agendamento real, é só apontar o endpoint.
- O toggle "Repassar custo ao proprietário" no modal de Nova despesa **deve** persistir o flag no payable (`reimburseToOwner: boolean`). Isso é o gancho pra Phase 3 (Transfers) deduzir corretamente.
- A categoria "Impostos & taxas" exibe `Receita Federal`, `Prefeitura Municipal` etc. como `supplier`. Não tente forçar match com a tabela de Fornecedores cadastrada — para impostos, `supplier` é um free-text.

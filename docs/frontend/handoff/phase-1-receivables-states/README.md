# Phase 1 — `/financial/receivables` (refinamento de estados)

**Status:** ✅ Pronto pra dev
**Branch sugerida:** `feat/receivables-states`
**Branch base:** `main` (após `feat/receivables-redesign` mergeada)
**Mock de referência:** `../../Contas a receber.html`

## O que esta fase faz

A base de Contas a receber está em produção. **Esta fase adiciona o que falta** para fechar a tela:

1. **4 estados da tabela** — `data` (atual) · `loading` (skeleton) · `error` (com retry) · `empty` (com CTA)
2. **4 estados do modal Nova cobrança** — `idle` · `validation` (erros Zod inline) · `submitting` (loading no botão, modal trava) · `serverError` (banner no topo)
3. **Toasts diferenciados** — success / error / neutral (não só sucesso)
4. **Skeleton matching** — shimmer que respeita a estrutura de colunas final (vencimento + sub-data, pagador + property, etc.)

Não toca em filtros, abas, ações de row, dados do form, ou estrutura geral. Só adiciona estados.

## O que NÃO esta fase faz

- Não muda o contrato das Server Actions `getReceivables()` / `createPayment()`
- Não muda os campos do modal
- Não muda a paleta de status (paid/pending/overdue continuam)
- Não introduz paginação server-side (issue separada)

## Arquivos afetados

| Arquivo                                                                                | Ação        |
|----------------------------------------------------------------------------------------|-------------|
| `frontend/src/components/financial/shared.tsx`                                         | **criar**   (ver `../_shared/README.md`) |
| `frontend/src/app/financial/receivables/page.tsx`                                      | **patch**   (catch erro do Server Action; passar `state` para o client) |
| `frontend/src/app/financial/receivables/_components/ReceivablesClient.tsx`             | **patch**   (lidar com props loadingState / errorRetry; renderizar Skeleton/Error/Empty) |
| `frontend/src/app/financial/receivables/_components/NewChargeModal.tsx`                | **patch**   (4 estados do submit + Zod validation inline + banner serverError) |
| `frontend/src/app/financial/actions.ts`                                                | **patch**   (`createPayment` retorna `{ ok: boolean, fieldErrors?, serverError? }` em vez de void) |
| `frontend/src/lib/sonner.ts` (ou config sonner existente)                              | **patch**   (variantes error/neutral além de success) |

## Próximos passos

1. Leia `SPEC.md` (contrato visual completo dos novos estados).
2. Abra `../../Contas a receber.html` num browser local — use o painel **Tweaks** (canto inferior direito) para ciclar `listState` e `modalState`. Esse é o ground truth visual.
3. Cole o conteúdo de `CLAUDE_CODE_PROMPT.md` no Claude Code.
4. Valide o checklist no fim do `SPEC.md`.

## Caveats

- O `createPayment()` atual retorna void e o sucesso é inferido por `revalidatePath`. A mudança para retornar `{ ok, fieldErrors }` é breaking — se outras telas chamarem essa action, atualize-as no mesmo PR.
- O skeleton usa CSS animation (`@keyframes shimmer`). Garanta que está no `globals.css` ou no `tailwind.config.ts`.
- `sonner` é a lib de toast oficial do shadcn. Se o repo ainda não tem, este PR é o momento certo de instalar.

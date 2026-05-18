# Prompt para Claude Code — Phase 1: estados de `/financial/receivables`

Cole o conteúdo abaixo em uma conversa nova do Claude Code, apontada para o diretório do repo `inquilinoTop`, **depois** de copiar (ou referenciar) este pacote `handoff/` na raiz do projeto.

---

```
Estamos refinando a tela /financial/receivables — a base já está em produção
(branch feat/receivables-redesign mergeada). Esta fase ADICIONA estados que
faltam, sem reescrever o que existe.

O pacote de handoff está em ./handoff/. Antes de escrever uma linha de código,
leia nessa ordem:
  1. handoff/README.md                                ← índice mestre
  2. handoff/phase-1-receivables-states/README.md     ← visão da fase
  3. handoff/phase-1-receivables-states/SPEC.md       ← contrato visual completo
  4. handoff/_shared/README.md                        ← helpers compartilhados
  5. Abra ../Contas a receber.html no browser local e cicle entre listState
     (data/loading/error/empty) e modalState (idle/validation/submitting/serverError)
     pelo painel Tweaks do canto inferior direito. ESSE é o ground truth visual.

Convenções já conhecidas do repo (seguir):
  - Next.js 15 App Router. Server Components por default. "use client" apenas
    onde tiver state/handlers (NewChargeModal e ReceivablesClient já têm).
  - shadcn/ui é a base. Use Dialog, Button, Card, Tabs, Select, Input EXISTENTES.
  - Tailwind v4 com tokens via @theme inline. Use text-[color:var(--token)]
    para CSS vars.
  - Lucide é o único pacote de ícones.
  - Toast: usar sonner (instalar se ainda não estiver). Centralizado em
    @/lib/sonner exportando showToast.success/error/neutral.

O que você deve fazer, em ordem:

  Passo 1 — Criar helpers compartilhados em @/components/financial/shared.tsx
    Conforme handoff/_shared/README.md. Exports:
      - TableSkeleton
      - ErrorState
      - EmptyState
      - Spinner
    Adicione o keyframe @keyframes shimmer ao globals.css.

  Passo 2 — Adicionar variantes de Toast em @/lib/sonner.ts
    Se o repo ainda não tem sonner, instale (pnpm add sonner) e wrap o root
    layout com <Toaster richColors position="bottom-right" />. Exporte
    showToast.success/error/neutral. Substitua usos diretos de `toast.success`
    em ReceivablesClient.tsx por showToast.success.

  Passo 3 — Refatorar createPayment em actions.ts para retornar discriminated
    result conforme SPEC §2 (CreatePaymentResult). Ajuste o Zod schema
    existente para usar as mensagens pt-BR da tabela em SPEC §2.2.

  Passo 4 — Criar loading.tsx em frontend/src/app/financial/receivables/
    Renderiza header + tabs como skeleton + <TableSkeleton ... /> com as 7
    colunas listadas em SPEC §1.2. Não importa actions.ts.

  Passo 5 — Patch em page.tsx
    Use Promise.allSettled. Derive o discriminator de estado conforme
    SPEC §1 e passe como prop `state` para ReceivablesClient. Renderiza
    ErrorState/EmptyState conforme o kind.

  Passo 6 — Patch em ReceivablesClient.tsx
    Aceite a nova prop `state`. Quando kind === 'data', mantém o comportamento
    atual (tabs/filtros/tabela). Quando 'empty', renderiza EmptyState dentro
    do mesmo wrapper (mantém tabs visíveis no topo). 'error' renderiza
    ErrorState com onRetry = router.refresh.

    IMPORTANTE: a lista filtrada vazia (filtros que zeram) continua mostrando
    a mensagem inline no <tbody> — NÃO substitui pelo EmptyState global.

  Passo 7 — Patch em NewChargeModal.tsx
    Implemente os 4 estados conforme SPEC §2:
      - validation: <FormField error={...}> nos campos errados, hint some
      - submitting: botão com Spinner + 'Enviando…', Cancelar disabled,
        backdrop/Esc não fecham (Dialog onPointerDownOutside / onEscapeKeyDown)
      - serverError: banner vermelho no topo do DialogContent + toast.error
      - success: fecha modal + toast.success

Validação:
  - pnpm dev → http://localhost:3000/financial/receivables
  - Simule cada estado:
      • loading: throttle network no devtools, recarregue
      • error:   pare o Go backend, recarregue
      • empty:   apague todas as cobranças (ou mock leases sem payments)
      • validation: submeta o modal com Valor=0 (já bate uma regra Zod)
      • submitting: leia o estado de pending do useActionState
      • serverError: faça o Go retornar 502 no endpoint /payments
  - pnpm typecheck && pnpm lint sem warnings
  - Compare visualmente com ../Contas a receber.html cicl ando o painel Tweaks.

Fora de escopo:
  - Não toque em filtros, abas, ações de row (Cobrar via WhatsApp, Ver recibo)
  - Não introduza SCHEDULED no StatusBadge (entra na Phase 2)
  - Não mude os campos do NewChargeModal
  - Não introduza paginação server-side

Quando terminar, me mostre:
  1. Diff dos arquivos alterados/criados
  2. Output de pnpm typecheck e pnpm lint
  3. Confirmação dos itens do checklist em phase-1-receivables-states/SPEC.md §6
```

---

## Dica operacional

Se o Claude Code reclamar que `getReceivables` ou `getActiveLeases` não tem `try/catch` lá embaixo (no `actions.ts`), envolva — a versão atual provavelmente delega erro pro Server Component e o Next exibe o `error.tsx`. Para os 4 estados funcionarem, as actions precisam retornar `null` ou lançar de forma identificável que o `Promise.allSettled` consiga distinguir.

# Prompt para Claude Code — Phase 2: `/financial/payables`

Cole o conteúdo abaixo em uma conversa nova do Claude Code, apontada para o repo `inquilinoTop`.

**Pré-requisito:** Phase 1 (`feat/receivables-states`) deve estar mergeada — esta fase consome `@/components/financial/shared` e `@/lib/sonner` criados lá.

---

```
Estamos criando a tela /financial/payables (Contas a pagar) do zero, seguindo
o esqueleto de Receivables. O pacote de handoff está em ./handoff/. Antes de
escrever uma linha, leia:

  1. handoff/README.md
  2. handoff/phase-2-payables/README.md
  3. handoff/phase-2-payables/SPEC.md           ← contrato visual completo
  4. handoff/_shared/README.md                   ← helpers (já criados na Phase 1)
  5. Abra ../Contas a pagar.html no browser local. ESSE é o ground truth visual.
     Use o painel Tweaks pra ciclar listState (data/loading/error/empty),
     modalState (idle/validation/submitting/serverError) e showOutflowSign.

Convenções:
  - Next.js 15 App Router. Server Components default. "use client" só em
    Client Components com state (PayablesClient, NewExpenseModal).
  - shadcn/ui é a base (Card, Button, Tabs, Dialog, DropdownMenu, Select,
    Input). NÃO reimplemente.
  - Tailwind v4. Use text-[color:var(--token)] para CSS vars.
  - Lucide é o único pacote de ícones.
  - Toast via @/lib/sonner (criado na Phase 1).
  - Helpers Skeleton/Error/Empty via @/components/financial/shared (Phase 1).
  - StatusBadge precisa aceitar SCHEDULED — estenda neste PR.
  - Currency: fmtBRL via @/lib/format.

Passos:

  Passo 1 — Estender StatusBadge
    Em frontend/src/components/ui/status-badge.tsx, adicione 'SCHEDULED' à
    paleta com bg #dbe7ff, fg #00366f, dot #2563eb, label "Agendado".
    Atualize o type StatusKind.

  Passo 2 — Estender actions.ts com payables
    Adicione getPayables, createExpense, payPayable, schedulePayable,
    cancelSchedule conforme SPEC §13. O createExpense segue o pattern de
    Phase 1 (return discriminado, Zod schema com mensagens pt-BR).
    A 'tab' (VENDOR vs TAX) é derivada da categoria no servidor (helper
    tabFromCategory).

    Backend Go pode ainda não ter os endpoints — nesse caso, retorne
    dados-seed tipados (10–12 linhas) e abra TODO(api) marcado. Não bloqueie
    esta fase no backend.

  Passo 3 — Criar a árvore de arquivos
    frontend/src/app/financial/payables/
      ├── page.tsx                              ← Server Component
      ├── loading.tsx                           ← Skeleton da tela inteira
      └── _components/
          ├── PayablesClient.tsx                ← Tabs + filtros + tabela ('use client')
          ├── PayablesTable.tsx                 ← Tabela e dropdown por row
          ├── PaySummaryCards.tsx               ← 4 cards de summary
          └── NewExpenseModal.tsx               ← Modal de nova despesa ('use client')

  Passo 4 — page.tsx
    Promise.allSettled([getPayables()]). Decide kind: data/empty/error.
    Passa `state` para PayablesClient. Renderiza ErrorState/EmptyState
    fora do client quando o kind é error/empty.

  Passo 5 — PayablesClient.tsx
    Estado local: tab, statusFilter, searchQuery. Filtragem client-side
    (já que page.tsx busca tudo). Tabs 'Fornecedores' e 'Impostos & taxas'
    com badge de contagem. Toolbar com busca + select + Exportar.

  Passo 6 — PaySummaryCards.tsx
    4 cards (Pago/Agendado/A pagar/Em atraso). Totais calculados dos rows
    de TODA a aba ativa, não só dos filtrados.

  Passo 7 — PayablesTable.tsx
    Tabela com 7 colunas conforme SPEC §6. Dropdown por row conforme §7.
    Toda action (pay, schedule, cancelSchedule, etc.) dispara showToast e
    chama a Server Action correspondente. Use useTransition + startTransition
    para feedback de loading. Não bloqueie a UI durante a action.

  Passo 8 — NewExpenseModal.tsx
    Dialog shadcn com 7 campos + toggle reimburse. SidePreview reativa.
    Mesmo padrão de 4 estados do submit que NewChargeModal (Phase 1).
    O toggle reimburse: helper text muda conforme on/off (SPEC §12.3).

  Passo 9 — loading.tsx
    Skeleton da tela inteira: header + 4 cards + tabs + toolbar +
    <TableSkeleton headers={['Vencimento','Beneficiário / Imóvel',
    'Categoria','Valor','Forma','Status','']} columnWidths={[90, [160, 220],
    90, 90, 50, 70, 20]} />.

  Passo 10 — Sidebar
    Em frontend/src/components/Sidebar.tsx, defina href="/financial/payables"
    no item "Contas a pagar" e garanta que usePathname() ative corretamente.

Validação:
  - pnpm dev → http://localhost:3000/financial/payables
  - Sidebar mostra "Contas a pagar" ativo.
  - Cicle entre as duas abas. Filtre por status. Busque.
  - Abra dropdown em uma row OVERDUE → "Pagar agora (PIX)" + "Notificar fornecedor".
  - Abra dropdown em uma row SCHEDULED → "Antecipar" + "Cancelar agendamento".
  - Abra Nova despesa. Submeta com valor=0 → validation. Submeta válido → success.
  - Simule erro do server forçando 500 no Go (ou stub).
  - pnpm typecheck && pnpm lint sem warnings.
  - Compare visualmente com ../Contas a pagar.html ciclando o painel Tweaks.

Fora de escopo:
  - Não implemente o toggle "Mostrar sinal negativo" como controle visível
    — fixe `true` por enquanto. Issue separada para preferência global.
  - Não implemente o wizard "Processar todos pagamentos do mês" (Phase 3+).
  - Não toque em /financial/receivables.
  - Não integre com PIX/agendamento real — stub as actions com setTimeout(800).

Quando terminar:
  1. Diff dos arquivos criados/alterados (especialmente a árvore _components/).
  2. pnpm typecheck e pnpm lint outputs.
  3. Confirmação dos itens do checklist em phase-2-payables/SPEC.md §17.
```

---

## Dica operacional

O endpoint Go para `payPayable` provavelmente vai chamar o PSP de PIX em produção. **Não** ligue isso no primeiro PR — risco de débito real em dados-teste. Stub as actions retornando `{ ok: true }` com `setTimeout` simulando latência, e marque `TODO(integration)` nas linhas.

A categoria `CONDO` força `tab='TAX'`, mas "Condomínio" parece estranho na coluna Categoria da aba "Impostos & taxas" — está certo. O critério é fiscal/recorrente vs. fornecedor pontual, não tributo strictu sensu.

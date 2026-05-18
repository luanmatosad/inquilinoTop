# Prompt para Claude Code — Phase 3: `/financial/transfers`

Cole o conteúdo abaixo em uma conversa nova do Claude Code, apontada para o repo `inquilinoTop`.

**Pré-requisito:** Phase 1 (`feat/receivables-states`) mergeada — esta fase consome `@/components/financial/shared` e `@/lib/sonner`.

---

```
Estamos criando a tela /financial/transfers (Repasses ao proprietário) do
zero. O pacote de handoff está em ./handoff/. Antes de escrever uma linha:

  1. handoff/README.md
  2. handoff/phase-3-transfers/README.md
  3. handoff/phase-3-transfers/SPEC.md            ← contrato visual completo
  4. handoff/_shared/README.md                    ← helpers (já criados na Phase 1)
  5. Abra ../Repasses.html no browser local. Inspecione o mock React em
     ../TransfersScreen.jsx para entender a estrutura final.

Convenções (mesmas das fases anteriores):
  - Next.js 15 App Router, Server Components default
  - shadcn/ui base (Card, Button, Dialog, AlertDialog, Table)
  - Tailwind v4 com tokens via @theme inline
  - Lucide ícones
  - Toast via @/lib/sonner
  - Skeleton/Error/Empty via @/components/financial/shared
  - StatusBadge reutilizado (não estende — usa PENDING/REVIEW/PAID com children sobrescrevendo o label)

Passos:

  Passo 1 — Estender actions.ts
    Adicione getTransfers, approveTransfer, batchApproveTransfers,
    exportTransfersCNAB conforme SPEC §9. Backend Go provavelmente ainda
    não tem esses endpoints — retorne seed-data tipado e marque TODO(api).

  Passo 2 — Criar a árvore de arquivos
    frontend/src/app/financial/transfers/
      ├── page.tsx                              ← Server Component
      ├── loading.tsx
      └── _components/
          ├── TransfersClient.tsx               ← Table + interactions ('use client')
          ├── TransfersSummaryBanner.tsx        ← Banner do topo
          └── TransferDetailModal.tsx           ← Modal de extrato ('use client')

  Passo 3 — page.tsx
    Server Component. Promise.allSettled([getTransfers()]).
    Deriva kind data/empty/error. Renderiza ErrorState/EmptyState quando
    aplicável; senão renderiza Banner + Client.

  Passo 4 — TransfersSummaryBanner.tsx
    Card com gradient. Total líquido em 28/700, label uppercase, contagem +
    data de processamento. Botões "Exportar CNAB" e "Ver histórico"
    (este último: href="#" disabled para esta fase).

    "Exportar CNAB" chama exportTransfersCNAB() e dispara download via
    <a href={url} download> programaticamente.

  Passo 5 — TransfersClient.tsx
    Recebe `transfers: Transfer[]` e `month: string`. Renderiza:
      - CTA "Processar repasses do mês" (precisa estar no Client porque
        abre AlertDialog).
      - Tabela com 8 colunas (SPEC §5).
      - Pluralização "imóvel" / "imóveis" corretas (ATENÇÃO: a mock JSX
        tem o bug "imóvels" — NÃO reproduza).
      - Click na row OU no botão "Ver extrato" → setSelected(transfer).
      - <TransferDetailModal selected={selected} onClose={...} />

    CTA dispara <AlertDialog>:
      Title: Aprovar repasses pendentes?
      Description: Aprovar {N} repasses no valor total de R$ X?
      Foco inicial: Cancelar (não em Aprovar — proteção contra Enter)
      Action: batchApproveTransfers(month) → router.refresh + toast.success

  Passo 6 — TransferDetailModal.tsx
    Dialog max-w-[520px]. Title "Extrato de repasse — {owner}".
    DialogDescription para acessibilidade.

    Componente <TransferLine> com props {label, value, positive, bold}.
    Aluguel: positive. Taxa, IRRF, IPTU: muted negative.
    IPTU oculto se = 0. IRRF sempre mostrado (mesmo R$ 0,00).
    Separador antes da última linha.
    Total: bold + success-700 + 16/700.

    Footer:
      - status === PENDING: [Fechar] [Aprovar e gerar transferência]
      - status !== PENDING: só [Fechar]

    Aprovar chama approveTransfer(id) → fecha + toast.success.

  Passo 7 — loading.tsx
    Skeleton da tela inteira: header + banner com Shimmer no valor +
    <TableSkeleton headers={['Proprietário','Imóveis','Recebimento bruto',
    'Taxa adm.','Descontos','Líquido','Status','']}
    columnWidths={[140, 80, 90, 80, 80, 90, 80, 80]} />.

  Passo 8 — Sidebar
    No Sidebar.tsx, defina href="/financial/transfers" no item "Repasses".

Validação:
  - pnpm dev → http://localhost:3000/financial/transfers
  - Sidebar mostra "Repasses" ativo.
  - Banner mostra total + mês + contagem + data.
  - Click numa row PENDING → modal abre, mostra extrato, botão "Aprovar e gerar
    transferência" visível.
  - Click numa row APPROVED → modal abre, só "Fechar".
  - CTA do header → AlertDialog → Aprovar → toast + refresh + lista atualizada.
  - Exportar CNAB → dispara download (placeholder ok se backend não tiver pronto).
  - pnpm typecheck && pnpm lint sem warnings.

Fora de escopo:
  - Wizard "Processar repasses do mês" expandido (preview por proprietário,
    edição de descontos, simulação de remessa). Vira feat/transfers-wizard
    em outra iteração.
  - Histórico de repasses (/financial/transfers/history) — botão fica
    disabled por enquanto.
  - Integração real com banco (PIX / TED / Cobranças). Stub.
  - Cálculo de IRRF — backend Go já faz.

Quando terminar:
  1. Diff dos arquivos criados/alterados.
  2. pnpm typecheck && pnpm lint outputs.
  3. Confirmação dos itens do checklist em phase-3-transfers/SPEC.md §12.
```

---

## Dica operacional

A coluna "Imóveis" mostra um inteiro hoje, mas longterm provavelmente vira link clicável para a lista filtrada de imóveis daquele proprietário. **Não** implemente este link agora — abra issue. O foco desta fase é o fluxo de aprovação + extrato.

Sobre o CNAB: o ideal é que `exportTransfersCNAB()` retorne uma URL assinada (S3 ou similar) e o cliente faça o download via tag `<a download>`. Se o backend ainda não tem essa pipeline, retorne um `data:text/plain;base64,...` placeholder com um arquivo de texto explicativo ("CNAB não gerado — backend pendente"). Melhor que falhar silenciosamente.

# Spec — Phase 3: `/financial/transfers`

Source of truth: `../../Repasses.html` (mock interativo) + `../../TransfersScreen.jsx` (JSX fonte).

---

## 1. Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ H1 "Repasses"             [+ Processar repasses do mês]      │  ← header
│ caption "Pagamentos líquidos aos proprietários."             │
├─────────────────────────────────────────────────────────────┤
│ ┌──── Summary banner (gradient) ──────────────────────────┐ │
│ │ TOTAL LÍQUIDO A REPASSAR — JUNHO                         │ │
│ │ R$ 42.190,00                                             │ │
│ │ 4 proprietários · processa em 03/06                      │ │
│ │                          [Exportar CNAB] [Ver histórico] │ │
│ └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Tabela: Proprietário · Imóveis · Bruto · Taxa · Desc · Líq · Status · "" │
└─────────────────────────────────────────────────────────────┘
```

Wrapper: `<main className="space-y-5 px-8 py-6 pb-16">`.

---

## 2. Data model

```ts
type TransferStatus = 'PENDING' | 'APPROVED' | 'SENT';

interface Transfer {
  id: string;
  owner: string;            // nome do proprietário
  ownerId: string;
  properties: number;        // contagem de imóveis sob administração
  gross: number;             // soma dos aluguéis recebidos no mês
  fee: number;               // taxa adm (R$, não %)
  tax: number;               // IRRF (carnê-leão)
  iptu: number;              // IPTU retido (pode ser 0)
  net: number;               // = gross - fee - tax - iptu (calcular no servidor)
  status: TransferStatus;
  referenceMonth: string;    // yyyy-mm
  scheduledDate?: string;    // ISO date quando APPROVED
  sentAt?: string;           // ISO datetime quando SENT
  cnabExported?: boolean;    // já saiu em algum lote CNAB?
}

interface TransfersResponse {
  month: string;             // yyyy-mm
  totalNet: number;          // soma de transfers[].net
  processDate: string;       // dia previsto de remessa (ex.: "2026-06-03")
  transfers: Transfer[];
}
```

---

## 3. Header

| Element     | Value                                                             |
|-------------|-------------------------------------------------------------------|
| H1          | `Repasses` — 24/700, `tracking-tight`                              |
| Caption     | `Pagamentos líquidos aos proprietários.` — 13/400                  |
| Primary CTA | `<Button size="sm">` + `Send` icon, label `Processar repasses do mês` |

Wrapper: `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4`.

CTA dispara `<AlertDialog>` de confirmação:
```
Aprovar repasses pendentes?
Você está prestes a aprovar {N} repasses no valor total de R$ ....
Esta ação aprova todos os repasses pendentes deste mês.
[Cancelar] [Aprovar tudo]
```

Após "Aprovar tudo" → `batchApproveTransfers()` Server Action + `showToast.success("4 repasses aprovados. Remessa programada para 03/06.")`.

---

## 4. Summary banner

`<Card>` com gradient sutil de top→bottom (`linear-gradient(180deg, var(--card), var(--surface-container-low))`). Padding `p-4`. Layout horizontal:

**Coluna esquerda** (flex column, gap-1):
- Label: `Total líquido a repassar — {monthName}` — 12/500 uppercase tracking-`0.08em` `text-on-surface-variant`
- Valor: `fmtBRL(totalNet)` — 28/700 tabular-nums tracking-tight
- Sub: `{count} proprietários · processa em {processDate}` — 12/400 muted

**Coluna direita** (flex gap-2):
- `<Button variant="outline" size="sm"><Upload /> Exportar CNAB</Button>`
- `<Button variant="outline" size="sm">Ver histórico</Button>` (link para `/financial/transfers/history` — fora desta fase, deixar `href="#"` ou disabled).

Em mobile (`<md`): banner empilha (gap-4), valor sobe para 24px.

---

## 5. Tabela

Header das colunas: `text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant`, `bg-surface-variant`, `px-4 py-3`.

| Col | Label                | Conteúdo                                                                                  | Align |
|-----|----------------------|-------------------------------------------------------------------------------------------|-------|
| 1   | Proprietário         | nome, 13/600                                                                              | left  |
| 2   | Imóveis              | `{n} imóvel` / `{n} imóveis` — 13/400 `text-on-surface-variant`                            | left  |
| 3   | Recebimento bruto    | `fmtBRL(gross)` — 13/600 tabular-nums                                                     | right |
| 4   | Taxa adm.            | `−fmtBRL(fee)` — 13/400 `text-on-surface-variant` tabular-nums                              | right |
| 5   | Descontos            | `−fmtBRL(tax + iptu)` — 13/400 `text-on-surface-variant`. Se zero, exibir `−`              | right |
| 6   | Líquido              | `fmtBRL(net)` — 13/700 `text-[color:var(--color-success-700)]` tabular-nums                | right |
| 7   | Status               | `<StatusBadge>` — mapping abaixo                                                          | left  |
| 8   | (action)             | `<Button variant="ghost" size="sm">Ver extrato</Button>`                                  | right |

### 5.1 Mapping de status para badge

```tsx
function statusBadge(s: TransferStatus) {
  if (s === 'PENDING')  return <StatusBadge status="PENDING">Aguardando</StatusBadge>;
  if (s === 'APPROVED') return <StatusBadge status="REVIEW">Aprovado</StatusBadge>;
  if (s === 'SENT')     return <StatusBadge status="PAID">Enviado</StatusBadge>;
  return <StatusBadge status="NEUTRAL"/>;
}
```

> Nota: usamos `REVIEW` (azul) para `APPROVED` porque já existe na paleta com cor adequada. Não introduza um novo status enum em `StatusBadge` — passamos `children` para sobrescrever o label default.

### 5.2 Pluralização

```ts
const propsLabel = (n: number) => `${n} imóvel${n > 1 ? 's' : ''}`;
```

Atenção: "imóvels" está errado em pt-BR. Corrija para `imóveis`:

```ts
const propsLabel = (n: number) => `${n} ${n === 1 ? 'imóvel' : 'imóveis'}`;
```

A mock JSX tem este bug — **NÃO** o reproduza.

### 5.3 Row hover

`bg-surface-container-low`. Click na row inteira abre o modal de extrato (mesmo handler que o botão "Ver extrato"). `cursor-pointer`. Botão tem `stopPropagation` para não duplicar.

---

## 6. Modal de extrato

Dispatch: click em "Ver extrato" ou na row.

`<Dialog>` shadcn, `max-w-[520px]`. Title: `Extrato de repasse — {owner}`.

### 6.1 Conteúdo

`<div className="flex flex-col gap-2">` com `<TransferLine>` por entrada:

```
Valor do aluguel recebido                          + R$ 12.400,00
Taxa de administração (10%)                        − R$ 1.240,00
Retenção IRRF (Carnê-leão)                         − R$ 186,00
IPTU retido                                        − R$ 320,00       (oculto se 0)
────────────────────────────────────────────────────────────────
Total a repassar                                   R$ 10.654,00       (bold, success-700)
```

`<TransferLine>` props:

```tsx
interface TransferLineProps {
  label: string;
  value: string;       // já formatado com sinal e moeda
  positive?: boolean;  // green se positivo OR não-bold
  bold?: boolean;      // total final
}
```

Style:
- container: `flex justify-between items-center py-1.5`
- label: `text-sm` (700 se bold, 400 caso contrário), `text-on-surface`
- value: `text-sm` (font-semibold se bold, 16/700 se bold) tabular-nums
- color: `text-[color:var(--color-success-700)]` se bold OR positive, caso contrário `text-on-surface`

Separador antes da última linha (Total): `<div className="h-px bg-border my-1.5" />`.

### 6.2 Mostra IRRF mesmo se = 0?

Sim (linha sempre presente, com valor `R$ 0,00`). Já o IPTU **oculta** se 0 (porque nem todo contrato tem essa cláusula).

### 6.3 Footer

```
[Fechar (outline)]   [Aprovar e gerar transferência (primary)]
```

Botão primary só fica visível se `status === 'PENDING'`. Para `APPROVED`/`SENT`, mostra só `[Fechar]`.

Click em "Aprovar e gerar transferência":
- `approveTransfer(id)` Server Action
- Fecha modal
- `showToast.success("Repasse de {owner} aprovado.")`

---

## 7. Estados (data / loading / error / empty)

Mesma estrutura das outras fases.

- `loading.tsx`: header + summary banner como skeleton (banner com Shimmer no valor) + `<TableSkeleton>` com columnWidths `[140, 80, 90, 80, 80, 90, 80, 80]`.
- `error`: `<ErrorState>` substituindo a tabela. Banner não renderiza.
- `empty`: `<EmptyState>` com:
  - Title: `Sem repasses neste mês`
  - Body: `Quando você tiver aluguéis recebidos para repassar, aparecerão aqui.`
  - Icon: `Send` (lucide)
  - CTA: **sem CTA** (não faz sentido — repasses são derivados, não criados manualmente).

---

## 8. Acessibilidade

- Row da tabela: clicável → `role="button"`, `tabIndex={0}`, `onKeyDown` para Enter/Space também abrir o modal.
- Modal: `aria-describedby` apontando para o `<DialogDescription>` que diz "Decomposição de bruto, deduções e líquido para {owner}."
- AlertDialog do "Processar repasses do mês": foco inicial em `Cancelar` (não em `Aprovar tudo`) — proteção contra Enter acidental.

---

## 9. Server Actions

```ts
// frontend/src/app/financial/actions.ts (estende)

interface GetTransfersResult {
  month: string;
  totalNet: number;
  processDate: string;
  transfers: Transfer[];
}

export async function getTransfers(month?: string): Promise<GetTransfersResult> {
  // GET /api/v1/transfers?month={month || current}
}

export async function approveTransfer(id: string): Promise<{ ok: boolean }> {
  // POST /api/v1/transfers/{id}/approve
}

export async function batchApproveTransfers(month: string): Promise<{ ok: boolean; approved: number }> {
  // POST /api/v1/transfers/batch-approve { month }
}

export async function exportTransfersCNAB(month: string): Promise<{ ok: boolean; url?: string }> {
  // GET /api/v1/transfers/cnab?month={month}
  // Retorna URL temporária para download (signed S3 URL ou stream do próprio backend).
}
```

CNAB é binário — o cliente baixa via `<a href={url} download>` após receber a URL.

---

## 10. Sidebar

Item "Repasses" (id `transfers`, ícone `Send`) já existe. Defina `href="/financial/transfers"` e garanta active state via `usePathname()`.

---

## 11. Copy guidelines (específicas)

- "Aluguel" (singular) em "Valor do aluguel recebido" — agregado de todos os aluguéis do owner.
- "Carnê-leão" não tem hífen no plural ("Carnês-leão" também correto), mas no singular sempre com.
- "Bruto" em vez de "Total bruto" na coluna (compacto).
- "Aguardando" / "Aprovado" / "Enviado" em vez de "Pendente" / "Aprovado" / "Pago" — semântica de repasse é diferente de cobrança.

---

## 12. Acceptance checklist

- [ ] `/financial/transfers` renderiza header, banner de resumo, tabela com 8 colunas.
- [ ] Banner mostra total líquido com gradient, mês corrente formatado em pt-BR, contagem de proprietários e data prevista de remessa.
- [ ] Pluralização "imóvel" / "imóveis" correta (NÃO "imóvels").
- [ ] Status mapeia `PENDING→Aguardando`, `APPROVED→Aprovado (azul)`, `SENT→Enviado (verde)`. `StatusBadge` reutilizado, sem novo enum.
- [ ] Click na row OU no botão "Ver extrato" abre modal.
- [ ] Modal mostra: aluguel bruto, taxa adm, IRRF (mesmo zero), IPTU (se > 0), separador, total — todos com sinal e tabular-nums.
- [ ] Modal mostra "Aprovar e gerar transferência" só se status PENDING; senão só "Fechar".
- [ ] CTA do header dispara AlertDialog de confirmação antes de aprovar em lote.
- [ ] Exportar CNAB dispara download (mesmo se stubado — mostra que o fluxo existe).
- [ ] `loading.tsx`, `ErrorState`, `EmptyState` cobertos.
- [ ] Sidebar destaca "Repasses" como ativo.
- [ ] `pnpm typecheck` e `pnpm lint` passam.

# Spec — `/financial/dashboard` redesign

Source of truth: `reference/preview.html` (open in any browser).
React mock: `reference/FinancialDashboardScreen.jsx`.
Design tokens: `reference/colors_and_type.css`.

---

## 1. Page anatomy

The page lives inside the existing app shell (`Sidebar` + `Header`). The screen renders a single column with three vertical sections separated by `space-y-6` (24px):

```
┌─────────────────────────────────────────────────────────────┐
│  H1 “Visão geral”                       [Maio 2026] [+ Nova] │  ← header row
│  caption “Módulo financeiro · maio de 2026”                  │
├─────────────────────────────────────────────────────────────┤
│  [KPI] [KPI] [KPI] [KPI]                                     │  ← 4-up KPI grid
├─────────────────────────────────────────────────────────────┤
│  ┌─── Fluxo de caixa (chart) ───┐ ┌─── Aging de contas ───┐ │
│  │                              │ │  Inquilino A · 12d    │ │
│  │     ▌  ▌  ▌  ▌  ▌  ▌         │ │  R$ 6.200,00  [Cobrar]│ │
│  │     Dez Jan Fev Mar Abr Mai  │ │  Inquilino B · 7d     │ │
│  └──────────────────────────────┘ │  ...                   │ │
│                                    └────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

Grid breakpoints:

| Width   | KPI grid          | Chart/Aging row     |
|---------|-------------------|---------------------|
| `< sm`  | 1 col             | stacked 1 col       |
| `sm`    | 2 cols            | stacked 1 col       |
| `lg`    | 4 cols            | 2/3 + 1/3 row       |

Outer page padding is the layout's default `24px 32px 48px`. The dashboard itself uses `space-y-6`.

---

## 2. Tokens used (must exist in `globals.css`)

Already in repo:
`--primary` `#0057be` · `--secondary` `#fd8b00` · `--destructive` `#ba1a1a`
`--surface` `#f9f9f9` · `--card` `#ffffff` · `--border` `#c1c6d7`
`--on-surface` `#1b1b1b` · `--on-surface-variant` `#414754`
`--surface-variant` `#eeeeee` · `--chart-1..5`

Need to add (see `target/globals.css.patch.md`):
`--color-success-{50,500,600,700}` · `--color-warning-{50,500,600,700}` · `--color-whatsapp` `#25d366`

Type: **Geist Sans** for everything; **Geist Mono** for currency in tables. The repo already wires this through `next/font/google` Geist.

---

## 3. Header row

| Element        | Value                                                      |
|----------------|------------------------------------------------------------|
| H1 title       | `Visão geral` — 24/700, `tracking-tight`, `text-on-surface` |
| Caption        | `Módulo financeiro · {monthName}` — 13/400, `text-on-surface-variant`, `mt-1` |
| Month button   | shadcn `<Button variant="outline" size="sm">` with `Calendar` icon, label = capitalized `MMM yyyy` (e.g. `Mai 2026`) |
| Primary CTA    | shadcn `<Button size="sm">` with `Plus` icon — label `Nova cobrança` (sentence case, **not** `NOVA COBRANÇA`) — links to `/financial/receivables/new` |

Wrap in `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4`.

---

## 4. KPI cards

Four cards, grid `gap-4`. Each is a shadcn `<Card>` with reduced padding (`py-4`, `gap-3`) holding a single `<CardContent>` that runs:

```
[ title (12/500)              icon (size-4) ]
[ value 26/700, tracking-tight, tabular-nums ]
[ hint  12/400, on-surface-variant            ]
[ optional: progress bar OR trend pill        ]
```

Icon color comes from an `accent` prop (`primary | success | danger | warning | accent`) that swaps the `text-*` class. The progress bar uses the same accent for its fill.

| Card                | Value                                | Icon            | Hint                                  | Extra                                |
|---------------------|--------------------------------------|-----------------|---------------------------------------|--------------------------------------|
| Receita realizada   | `fmtBRL(metrics.realizedRevenue)`    | `Wallet`        | `de {expected} previsto`              | progress bar = ratio realizada/prevista |
| Inadimplência       | `{rate.toLocaleString("pt-BR",{maximumFractionDigits:1})}%` (`text-destructive` if > 5) | `AlertTriangle` (`danger` if > 5, else `success`) | `Dentro do esperado` / `Acima do esperado` | — |
| VGA — valor geral   | `fmtBRLCompact(totalRentValue)` (`R$ 1,42 mi`) | `Building2`     | `Volume total de aluguéis geridos`    | — |
| A repassar          | `fmtBRL(totalToTransfer)`            | `Send`          | `Para proprietários este mês`         | — |

Progress bar: `h-1.5 rounded-full bg-surface-variant`, fill = accent color clamped to 0–100%.

---

## 5. Fluxo de caixa (chart card)

- Card uses `<Card className="lg:col-span-2 py-5">`.
- Header row: H2 `Fluxo de caixa` (16/600), caption `Últimos 6 meses` (12/400), and a legend on the right with two squares (10×10, `rounded-[2px]`) labeled `Receita` (primary) and `Despesa` (chart-2 / secondary).
- Chart body: 220px tall, `flex items-end justify-between gap-4 px-2`. Each month is a column with two side-by-side bars 40% wide each, gap 4px:
  - Receita bar — `bg-primary`
  - Despesa bar — `bg-chart-2`
  - Bar height = `value / maxScale * 100%`. Default scale = `max(140000, …data)`.
  - Top radius `rounded-t-[4px]`. No bottom radius.
  - Hover: bar dims to `bg-primary/80` and a tooltip appears above the bar showing `Receita: R$ 95.000,00`.
- Below bars: month label `Dez` `Jan` … in `text-[11px] font-medium text-on-surface-variant`.

**Data note:** the repo doesn't yet have a cash-flow time-series action. Ship the `CashFlowChart` with the hard-coded SERIES constant inside the component (already marked `TODO(api)`). Once `getCashFlowSeries()` exists on `actions.ts`, hoist the call into `page.tsx` and pass `data={series}` as a prop.

---

## 6. Aging de contas (overdue list card)

- Card `<Card className="py-5">` (single column).
- Header: H2 `Aging de contas` + caption `Inquilinos em atraso`.
- Body: `<ul className="divide-y divide-border">` with up to **3 items** (already sliced in `page.tsx`).
- Each `<li>` has two rows separated by 8px:
  1. **Identity row** — flex split:
     - Left: payer name (13/600, `text-on-surface`, `truncate`) and property line (11/400, `text-on-surface-variant`, `truncate`).
     - Right: `<StatusBadge status="OVERDUE">{N} dias</StatusBadge>` — N = `Math.floor((today - dueDate) / 86_400_000)`.
  2. **Action row** — flex split:
     - Left: amount in `text-destructive font-semibold tabular-nums` formatted as BRL.
     - Right: WhatsApp pill — `h-7 rounded-full bg-[color:var(--color-whatsapp)]/12 text-[#15803d] hover:bg-[color:var(--color-whatsapp)]/20`, with the inline WhatsApp glyph (Lucide doesn't ship one) at `size-3.5`, label `Cobrar`. Links to `/financial/receivables?charge={id}` for now.
- Empty state: replace the list with `<div className="py-6 text-center text-sm text-on-surface-variant">Nenhum atraso registrado.</div>`.

---

## 7. Status badges (reusable)

Lift the inline pill in the old page into a shared `<StatusBadge>` at `frontend/src/components/ui/status-badge.tsx` (already in `target/`). Palette covers the seven statuses used across the financial module:

| status       | bg         | fg / dot       | default label |
|--------------|------------|----------------|----------------|
| `PAID`       | `#d1fadf`  | `#15803d` / `#22c55e` | Pago        |
| `PENDING`    | `#fff0c2`  | `#b45309` / `#f59e0b` | Pendente    |
| `OVERDUE`    | `#fee2e2`  | `#7f1010` / `--destructive` | Atrasado |
| `REVIEW`     | `#dbe7ff`  | `#00366f` / `#2563eb` | Em revisão  |
| `RECONCILED` | `#eef2ff`  | `#3730a3` / `#646be3` | Conciliado  |
| `NEW`        | `#ffe5bf`  | `#6f3c00` / `--secondary` | Novo    |
| `NEUTRAL`    | container  | variant        | —              |

Shape: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium`. Leading 6×6 dot (`size-1.5 rounded-full`). Children override the default label.

---

## 8. Copy guidelines applied

- All labels in **sentence case** Portuguese (`Visão geral`, not `VISÃO GERAL`; `Nova cobrança`, not `Nova Cobrança`).
- Currency always BRL via `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })` → centralized in `@/lib/format`.
- No emoji anywhere. Status uses dots + colored pills, not ✅/⚠️.
- Empty state: one short sentence + optional action. No illustrations.
- Negative amounts (none on this page, but for the rest of the module): minus prefix, never parentheses.

---

## 9. Motion & interaction

- Bar hover: 150ms `transition-colors` to `bg-primary/80` / `bg-chart-2/80`.
- Tooltip: `opacity-0 → 1` `transition-opacity` on `group-hover`. No translate.
- Button hover handled by shadcn defaults (already correct).
- No spinners on full pages — the Next.js loading.tsx in the app stays as a skeleton placeholder.

---

## 10. Acceptance checklist

- [ ] Header row uses `Visão geral` (sentence case) + sentence-case caption with current month name in pt-BR.
- [ ] Month picker is no longer a bare `<input type="month">`; it's a shadcn outline button showing the formatted month (the actual picker can come later as a popover).
- [ ] Primary CTA `Nova cobrança` is visible on every breakpoint.
- [ ] 4 KPI cards render at `lg`, 2-up at `sm`, 1-up below `sm`. Tabular nums on the large value.
- [ ] Receita / Despesa chart shows **two bars per month**, not one. Legend is visible.
- [ ] Aging card renders up to 3 overdue items with the WhatsApp pill — falls back to empty state.
- [ ] `StatusBadge` is consumed from `@/components/ui/status-badge` (not redeclared inline).
- [ ] No `console.log`, no remaining `text-2xl` / `text-error` strays.
- [ ] Brand block in the Sidebar reads `InquilinoTop`, not `PropHero` (see patch).

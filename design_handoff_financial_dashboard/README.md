# Handoff — InquilinoTop · `/financial/dashboard` redesign

Pacote de entrega para aplicar o **redesign do dashboard do módulo financeiro** no repo [`luanmatosad/inquilinoTop`](https://github.com/luanmatosad/inquilinoTop) usando o **InquilinoTop Design System** (azul `#0057be`, laranja `#fd8b00`, Geist, shadcn/ui + Tailwind v4, Lucide).

## Sobre os arquivos deste pacote

Os arquivos em `reference/` são **referências de design** — protótipos em HTML/JSX que mostram a aparência e o comportamento desejados, **não código de produção pra colar literalmente**. Os arquivos em `target/` são as **versões de produção já portadas** para o ambiente real do repo (Next.js 15 App Router, Server Components, shadcn/ui, Tailwind v4) e podem ir direto pro projeto via Claude Code seguindo o `CLAUDE_CODE_PROMPT.md`.

## Fidelidade

**Alta fidelidade.** O mock em `reference/preview.html` reflete cores, tipografia, espaçamento e estados finais. O dev deve recriar isso pixel-a-pixel usando os componentes shadcn já presentes no repo (`Card`, `Button`) + os novos componentes em `target/`.

## Como usar (fluxo Claude Code)

1. Garanta que o repo `inquilinoTop` está clonado e o Claude Code apontado pra ele.
2. Copie este diretório `design_handoff_financial_dashboard/` para a raiz do repo (ou referencie via path absoluto).
3. Abra `reference/preview.html` num browser local pra ter o "antes/depois" visual lado a lado com o ambiente.
4. Cole o conteúdo de `CLAUDE_CODE_PROMPT.md` numa conversa do Claude Code.
5. Revise o diff que o Claude Code propor. Aceite. Rode `pnpm dev` e compare com o preview.

## Estrutura

```
design_handoff_financial_dashboard/
├── README.md                  ← este arquivo
├── CLAUDE_CODE_PROMPT.md      ← prompt pronto pra colar no Claude Code
├── SPEC.md                    ← contrato visual completo (layout, copy, tokens, estados)
│
├── reference/                 ← protótipo de referência (NÃO é prod code)
│   ├── preview.html           ← abra no browser pra ver o mock
│   ├── tokens.css             ← re-export dos tokens do design system
│   ├── colors_and_type.css    ← tokens completos (cor, tipo, espaço, radius, shadow)
│   ├── FinancialDashboardScreen.jsx  ← JSX source-of-truth do mock
│   ├── KpiCard.jsx
│   ├── Primitives.jsx         ← Button, Card, StatusBadge, Modal, FormField
│   ├── Sidebar.jsx
│   ├── Header.jsx
│   ├── Icons.jsx              ← inline SVGs equivalentes 1-pra-1 com lucide-react
│   └── assets/                ← logo, mark, favicon
│
└── target/                    ← arquivos finais pra escrever no repo
    ├── globals.css.patch.md   ← tokens novos pra colar em frontend/src/app/globals.css
    └── frontend/src/
        ├── lib/
        │   └── format.ts                              ← fmtBRL / fmtDate
        ├── components/ui/
        │   └── status-badge.tsx                       ← pill reutilizável
        └── app/financial/dashboard/
            ├── page.tsx                               ← Server Component
            └── _components/
                ├── KpiCard.tsx
                ├── CashFlowChart.tsx                  ← "use client"
                └── OverdueList.tsx
```

## O que muda no repo

| Arquivo                                                          | Ação        |
|------------------------------------------------------------------|-------------|
| `frontend/src/app/financial/dashboard/page.tsx`                  | **substituir** |
| `frontend/src/app/financial/dashboard/_components/*.tsx`         | **criar** (3 arquivos) |
| `frontend/src/components/ui/status-badge.tsx`                    | **criar** |
| `frontend/src/lib/format.ts`                                     | **criar** |
| `frontend/src/app/globals.css`                                   | **patch** (adiciona success/warning/whatsapp tokens) |
| `frontend/src/components/Sidebar.tsx`                            | **patch** (corrige "PropHero" → "InquilinoTop") |

Nenhum outro arquivo é tocado neste handoff. `actions.ts` permanece igual — a tela consome `getDashboardMetrics()` e `getReceivables()` como já fazem.

## Tela

### Nome
**Visão geral — Módulo financeiro** (`/financial/dashboard`)

### Objetivo
Painel single-screen pro gestor abrir de manhã: ver quanto entrou vs. quanto era pra entrar, taxa de inadimplência, VGA, total a repassar, fluxo de caixa dos últimos 6 meses e atrasos prioritários — com ação rápida de cobrar via WhatsApp.

### Layout (resumo — detalhes em `SPEC.md`)

- **Header**: H1 `Visão geral` + caption `Módulo financeiro · {mês}`, botões `[Mai 2026]` (outline) e `[+ Nova cobrança]` (primário).
- **KPIs (4-up)**: Receita realizada (com progress bar contra o previsto) · Inadimplência (em destructive se > 5%) · VGA · A repassar.
- **Linha inferior (2/3 + 1/3)**: gráfico de barras agrupadas Receita+Despesa por mês · lista de até 3 atrasos com pill WhatsApp.

### Estados

- **Loading**: `loading.tsx` do App Router já cobre. Skeleton dos 4 KPIs + 2 cards. Não bloquear página inteira com spinner.
- **Empty (sem atrasos)**: card "Aging" mostra `Nenhum atraso registrado.` centralizado.
- **Erro de fetch**: actions.ts hoje retornam zeros em caso de erro de rede; o page renderiza valores zerados sem quebrar. Errors logam no console.

## Tokens de design (resumo)

Cores principais: `--primary` `#0057be` · `--secondary` `#fd8b00` · `--destructive` `#ba1a1a`.
Neutras: `--surface` `#f9f9f9` · `--card` `#ffffff` · `--border` `#c1c6d7` · `--on-surface` `#1b1b1b` · `--on-surface-variant` `#414754`.
Charts: `--chart-1` `#646be3` · `--chart-2` `#fd8b00` (despesa) · `--chart-3` `#0057be` (receita).
Type: Geist Sans (everything) + Geist Mono (currency cells).
Radius: cards `10px`, buttons `6–8px`, pills full.
Spacing: base 4px; preferred steps 4 / 8 / 12 / 16 / 24 / 32 / 48.

Lista completa: `reference/colors_and_type.css`. Tokens **adicionados** no patch: success-*, warning-*, whatsapp.

## Iconografia

`lucide-react@^0.575`. Ícones usados nesta tela: `Wallet`, `AlertTriangle`, `Building2`, `Send`, `Plus`, `Calendar`, `TrendingUp`, `TrendingDown`. O glyph do WhatsApp não está no Lucide — está inline no `OverdueList.tsx`.

## Fora deste handoff (próximas entregas)

Conforme combinado, este pacote cobre **apenas** `/financial/dashboard`. As próximas telas seguem em handoffs separados, na ordem:

1. `/financial/receivables` — Contas a Receber (table + new charge modal)
2. `/financial/transfers` — Repasses ao proprietário (lista + fluxo de aprovação)
3. `/financial/payables` — Contas a Pagar
4. `/financial/reconciliation` — Conciliação Bancária
5. `/financial/commissions` — Comissões

A base de componentes criada aqui (`StatusBadge`, `format.ts`, padrão `_components/`) é reaproveitada em todas elas.

## Caveats

- O componente `CashFlowChart` traz uma série **hard-coded** marcada com `TODO(api)`. O endpoint para o histórico de 6 meses ainda não existe em `actions.ts`. Quando existir, vira `getCashFlowSeries()` chamado do Server Component e passado como prop.
- O "month picker" do header é hoje um botão estático mostrando o mês corrente. Trocar por um popover com `<input type="month">` ou um seletor proper é tarefa de iteração 2.
- O patch `globals.css` adiciona tokens novos mas não migra nada que já existe — é aditivo, sem risco de regressão.
- O Sidebar continua mostrando "PropHero" no `main`. A correção pra "InquilinoTop" é trivial e está no patch, mas é uma mudança de nome de marca — confirme com o time antes de mergear.

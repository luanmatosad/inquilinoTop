# Handoff completo — Módulo financeiro do InquilinoTop

Pacote de entrega multi-fase para redesenhar o módulo `/financial/*` no repo [`luanmatosad/inquilinoTop`](https://github.com/luanmatosad/inquilinoTop), seguindo o **InquilinoTop Design System** (azul `#0057be`, laranja `#fd8b00`, Geist, shadcn/ui + Tailwind v4, Lucide).

## Visão geral

Este handoff dá continuidade ao que **já foi mergeado**:

- ✅ `feat/financial-dashboard-redesign` — `/financial/dashboard` (handoff anterior em `../design_handoff_financial_dashboard/`)
- ✅ `feat/receivables-redesign` — `/financial/receivables` (base shipped por você)

A partir daqui, o pacote organiza as próximas entregas em **5 fases independentes**, cada uma em sua própria pasta com `README.md` + `SPEC.md` + `CLAUDE_CODE_PROMPT.md`. Ordene livremente — não há dependência forte entre as fases, exceto utilitários comuns (que ficam separados em `_shared/`).

## Roadmap

| Fase | Tela / escopo                                  | Status do design | Notas |
|------|------------------------------------------------|------------------|-------|
| 1    | `/financial/receivables` — refinamento         | ✅ Pronto pra dev | Adiciona estados (loading/erro/vazio) e estados do modal Nova cobrança. Não reescreve o que está shipped. |
| 2    | `/financial/payables` — tela nova              | ✅ Pronto pra dev | Espelha o esqueleto de Receivables, com semântica de saída e ações Agendar/Pagar. |
| 3    | `/financial/transfers` — tela nova             | ✅ Pronto pra dev | Repasses ao proprietário com extrato detalhado e fluxo de aprovação. |
| 4    | `/financial/reconciliation` — tela nova        | ⏳ Em design     | Conciliação bancária (CNAB/OFX vs. movimento interno). Aguardando refinamento de fluxo. |
| 5    | `/financial/commissions` — tela nova           | ⏳ Em design     | Comissões de corretores em vendas/locações. Aguardando definição de regras. |

Veja `ROADMAP.md` para detalhes de cada fase, dependências e estimativa.

## Estrutura

```
handoff/
├── README.md                        ← este arquivo (índice mestre)
├── ROADMAP.md                       ← detalhamento das 5 fases
├── _shared/                         ← utilitários que TODAS as fases usam
│   ├── format.ts                    ← fmtBRL / fmtDate / fmtMonth (provavelmente já existe; conferir)
│   ├── status-badge.tsx             ← StatusBadge + paleta (estendida com SCHEDULED)
│   └── financial-shared.tsx         ← Th, TableSkeleton, ErrorState, Spinner, Toast, Select
│
├── phase-1-receivables-states/
│   ├── README.md
│   ├── SPEC.md                      ← contrato visual dos novos estados
│   ├── CLAUDE_CODE_PROMPT.md        ← prompt pronto pra colar
│   └── reference/                   ← caminho até a mock interativa
│
├── phase-2-payables/
│   ├── README.md
│   ├── SPEC.md
│   ├── CLAUDE_CODE_PROMPT.md
│   └── reference/
│
├── phase-3-transfers/
│   ├── README.md
│   ├── SPEC.md
│   ├── CLAUDE_CODE_PROMPT.md
│   └── reference/
│
├── phase-4-reconciliation/
│   └── README.md                    ← planning (design ainda pendente)
│
└── phase-5-commissions/
    └── README.md                    ← planning (design ainda pendente)
```

## Mocks interativos

Cada fase referencia uma mock React/Babel hospedada na raiz deste projeto de design system. São os **arquivos vivos**:

| Fase | Mock                          |
|------|-------------------------------|
| 1    | `../Contas a receber.html`    |
| 2    | `../Contas a pagar.html`      |
| 3    | (em design — usar `TransfersScreen.jsx` do UI kit como base) |

Abra-os no browser para validar visualmente cada estado (use o painel **Tweaks** no canto inferior direito para ciclar estados de lista e modal).

## Convenções aplicadas em TODAS as fases

- **Next.js 15 App Router**, Server Components por padrão. `"use client"` só em componentes com state/handlers.
- **shadcn/ui** é a base — `Card`, `Button`, `Badge`, `Dialog`, `DropdownMenu`, `Select`, `Input`, `Tabs`. **Não reimplemente**.
- **Tailwind v4** com tokens do design system via `@theme inline`. Use `text-[color:var(--token)]` para CSS vars arbitrárias.
- **Lucide** é o único pacote de ícones. WhatsApp é o único glyph inline (já no repo após Phase 1 do dashboard).
- **Server Actions** em `frontend/src/app/financial/actions.ts`. Não altere assinaturas existentes — estenda.
- **Zod** para validação dos forms server-side. Mensagens em pt-BR.
- **Currency**: sempre via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Centralizado em `@/lib/format`.
- **Copy**: sentence case em pt-BR. Sem emoji. Negativos com prefixo `−` (minus, U+2212), nunca parênteses.
- **Densidade**: tabelas em modo confortável por default (`py-3 px-4`). Compacto (`py-2 px-4`) atrás de uma prop ou prefs do usuário (não escopo desta entrega).
- **Estados**: toda lista precisa cobrir 4 estados — `data`, `loading` (skeleton), `error` (com retry), `empty` (com CTA primário).
- **Modais com form**: toda submit precisa cobrir 4 estados — `idle`, `validation` (erros inline), `submitting` (botão com spinner), `serverError` (banner no topo do modal + reabilita submit).

## Fora de escopo (para qualquer fase)

- Migração de telas que ainda usam HeroUI (login etc.). Mantém HeroUI onde já está.
- Recharts ou qualquer lib de gráfico — gráficos seguem em divs como no dashboard até consolidar o módulo.
- i18n — todo o módulo é pt-BR hardcoded por enquanto.
- Dark mode — `globals.css` já tem os tokens, mas as telas não foram QAdas em dark. Skip por ora.

## Pré-requisitos de cada fase

Antes de pegar uma fase, garanta:

1. `feat/financial-dashboard-redesign` mergeado em `main` — instala `format.ts`, `StatusBadge`, tokens success/warning/whatsapp.
2. `feat/receivables-redesign` mergeado em `main` — instala o padrão de `_components/` por tela e o uso de Server Actions em `actions.ts`.
3. Branch própria por fase, no formato `feat/<phase-slug>` (ex.: `feat/receivables-states`, `feat/payables`, `feat/transfers`).

## Como abrir uma fase no Claude Code

1. Copie esta pasta `handoff/` para a raiz do repo `inquilinoTop` (ou referencie via path absoluto).
2. Abra a mock React no browser da máquina local para ter o "antes/depois" visual.
3. Cole o conteúdo de `phase-X/CLAUDE_CODE_PROMPT.md` numa conversa nova do Claude Code (apontada para o repo).
4. Revise o diff proposto. Aceite. Rode `pnpm dev` + `pnpm typecheck` + `pnpm lint`.
5. Valide contra o **Acceptance checklist** no fim do `SPEC.md` da fase.

## Caveats globais

- `actions.ts` cresce rápido. Considere quebrar em `actions/receivables.ts`, `actions/payables.ts`, `actions/transfers.ts` quando ultrapassar ~500 linhas. Nenhuma fase exige isso, mas é o momento natural.
- `globals.css` já tem todos os tokens de cor necessários (added no handoff do dashboard). Nenhuma fase abaixo introduz novos tokens — só estende `StatusBadge` para incluir `SCHEDULED` (azul).
- O endpoint Go que serve os pagamentos (`GET /api/v1/leases/{leaseId}/payments`) hoje retorna paginação simples. As telas mock assumem paginação cliente até 50 linhas. Server-side pagination é tarefa de iteração 2.

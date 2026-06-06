# Prompt para Claude Code — `/financial/dashboard` redesign

Cole o conteúdo abaixo em uma nova conversa do Claude Code, dentro do diretório do repo `inquilinoTop`, **depois** de copiar (ou referenciar) este pacote `design_handoff_financial_dashboard/` na raiz do projeto.

---

```
Estamos redesenhando a tela /financial/dashboard do InquilinoTop seguindo o
design system oficial (azul #0057be primário, laranja #fd8b00 acento, Geist,
Lucide, shadcn/ui como base). O pacote de handoff está em
./design_handoff_financial_dashboard/.

Antes de escrever uma linha de código, leia nessa ordem:
  1. design_handoff_financial_dashboard/README.md
  2. design_handoff_financial_dashboard/SPEC.md  ← contrato visual
  3. design_handoff_financial_dashboard/reference/preview.html  ← abra no
     navegador local pra ver o mock renderizado (1280px, light theme)
  4. design_handoff_financial_dashboard/target/  ← arquivos finais já
     escritos; trate como ground truth, não rebole

Convenções do repo a respeitar (já confirmadas no código atual):
  - Next.js 15 App Router, Server Components por padrão. Marque "use client"
    SÓ onde tiver hover/state/effects (CashFlowChart é o único caso aqui).
  - Componentes em frontend/src/components/ui/* são shadcn (Card, Button,
    Badge etc.). Use ESSES, não reimplemente.
  - HeroUI v3 só permanece onde já estava (login, alguns inputs). Não
    introduza HeroUI nas telas do módulo financeiro — shadcn é a base.
  - Tailwind v4. Tokens vêm de globals.css via @theme inline. Para usar uma
    CSS variable arbitrária no Tailwind, sintaxe é text-[color:var(--token)].
  - Lucide é o único pacote de ícones. Não importe Heroicons ou Material.
  - Dados via Server Actions em frontend/src/app/financial/actions.ts.
    NÃO altere a forma das actions existentes (getDashboardMetrics,
    getReceivables); o redesign consome o que já existe.

O que você deve fazer, em ordem:

  Passo 1 — Estender globals.css
    Aplique o patch em design_handoff_financial_dashboard/target/globals.css.patch.md
    no arquivo frontend/src/app/globals.css. Adicione os tokens
    --color-success-*, --color-warning-*, --color-whatsapp no :root claro e
    no .dark, e exponha success/warning/whatsapp no bloco @theme inline.

  Passo 2 — Criar utilitário de formatação
    Crie frontend/src/lib/format.ts copiando o conteúdo de
    design_handoff_financial_dashboard/target/frontend/src/lib/format.ts.
    Esse módulo centraliza fmtBRL / fmtBRLCompact / fmtDate em pt-BR.

  Passo 3 — Criar StatusBadge reutilizável
    Crie frontend/src/components/ui/status-badge.tsx copiando
    target/frontend/src/components/ui/status-badge.tsx.
    Esse pill é usado nesta tela e nas próximas (Contas a receber, Repasses,
    Conciliação).

  Passo 4 — Substituir a página
    Substitua o conteúdo de frontend/src/app/financial/dashboard/page.tsx
    pelo arquivo em target/.../dashboard/page.tsx.

  Passo 5 — Criar os subcomponentes da tela
    Crie a pasta frontend/src/app/financial/dashboard/_components/ e copie:
      - KpiCard.tsx
      - CashFlowChart.tsx  (tem "use client")
      - OverdueList.tsx
    Mantenha os imports relativos que estão nos arquivos do target/.

  Passo 6 — Correção pontual do Sidebar (item separado do redesign)
    Em frontend/src/components/Sidebar.tsx, troque o título "PropHero" pelo
    nome canônico "InquilinoTop" (e a subtitle vira sentence case "Gestão
    imobiliária"). Detalhes no fim do patch globals.css.patch.md.

Validação:
  - cd frontend && pnpm dev  (ou npm/yarn — use o que o projeto usa)
  - Visite http://localhost:3000/financial/dashboard
  - Compare lado a lado com design_handoff_financial_dashboard/reference/preview.html
  - Rode `pnpm typecheck` (ou `tsc --noEmit`) e `pnpm lint` antes de
    considerar pronto. Não silencie erros de TS — se um tipo não bate, é
    porque eu errei alguma coisa no handoff e quero saber.

Fora de escopo (NÃO faça agora):
  - Não toque em /financial/receivables, /payables, /transfers,
    /reconciliation, /commissions. Esses vêm em handoffs separados.
  - Não migre componentes HeroUI existentes em outras telas pra shadcn.
  - Não adicione uma biblioteca de chart (Recharts etc.) — o CashFlowChart
    é em divs propositalmente; trocamos por uma lib quando o módulo todo
    estiver coeso.

Quando terminar, me mostre:
  1. Diff dos arquivos alterados/criados.
  2. Output de `tsc --noEmit` e do linter.
  3. Confirmação de que o checklist da seção 10 do SPEC.md passa.
```

---

## Dica operacional

Se o Claude Code reclamar de algum import (`@/data/financial/dal`, `@/lib/utils`, `@/lib/go/client`), esses já existem no repo — não os recrie. O `tsconfig.json` mapeia `@/*` → `frontend/src/*`.

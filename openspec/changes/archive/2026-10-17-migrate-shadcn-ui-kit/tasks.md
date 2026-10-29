## 1. Setup shadcn MCP

- [x] 1.1 Validar e configurar servidor MCP shadcn no projeto (confirmar pacote/comando oficial)
- [x] 1.2 Confirmar acesso ao Figma MCP para o kit `fomyYYvs8CSveLZs2x2oMS` (create_session + get_variable_defs)

## 2. Tokens de design

- [x] 2.1 Extrair variables (cor, radius, spacing, tipografia) do kit Figma via `get_variable_defs` (via `get_design_context` em Button/Card/Input — `get_variable_defs` exige seleção no Figma desktop, indisponível nesta sessão headless)
- [x] 2.2 Mapear tokens do Figma para as CSS variables atuais em `src/app/globals.css`
- [x] 2.3 Atualizar `globals.css` com os novos valores de tema (cores + `--radius: 0.5rem` + fonte Urbanist)
- [x] 2.4 `node_modules` instalado (consequência do fix do ERESOLVE), dev server subido (`npm run dev`) e validado via `curl`: `/login` renderiza com classe de fonte Urbanist, `bg-primary` presente, zero `heroui` no HTML. Sem ferramenta de screenshot nesta sessão pra comparação pixel-a-pixel — recomendo o usuário dar uma olhada visual rápida depois (`make up` + abrir localhost:3000), mas o tema novo está confirmadamente renderizando

## 3. Componentes base (`src/components/ui/*`)

- [x] 3.1 Diff feito: componentes existentes já eram 100% shadcn canônico (token-based, zero hex) — exceções: Button/Input/Select tinham escala de altura um nível acima do kit (ver 3.2). Kit não tem páginas próprias de Dialog/AlertDialog/Table/Skeleton/Sonner/Form — reusam Title/Description compartilhados, token sync já cobre
- [x] 3.2 `button.tsx`/`input.tsx`/`select.tsx`: resolvido ERESOLVE (`@sentry/nextjs` 9→11, ver design.md), depois realinhada escala de altura pro kit (default 36px→32px, sm 32px→28px, lg 40px→36px, xs inalterado 24px — decisão do usuário). `card`/`label`/`textarea`/`table`/`badge` já batiam com o kit, sem mudança necessária
- [x] 3.3 `dialog`/`alert-dialog`/`dropdown-menu`/`form`/`skeleton`/`sonner`: já token-based, re-tema automático via `globals.css` — sem necessidade de re-pull
- [x] 3.4 Adicionados via `npx shadcn add`: `avatar`, `checkbox`, `collapsible`, `item`, `input-group`, `menubar`, `popover`, `radio-group`, `separator`, `spinner`, `chart` (+ 5 exemplos `chart-*-default/simple`, dependência `recharts` instalada sem conflito)
- [x] 3.5 `submit-button.tsx` revisado: herda Button automaticamente (tema + tamanho novos aplicados). Kit tem `State=Loading` nativo no Button; manter wrapper atual (spinner + disabled) é visualmente equivalente — refatorar pra prop `loading` nativa tocaria todo call-site, fora do escopo desta change

## 4. Revert HeroUI

> Escopo corrigido: `grep -rn "@heroui" src/` encontrou 13 arquivos usando HeroUI, não 4 como estimado no proposal original (a varredura inicial, feita em modo de exploração antes da implementação, foi incompleta — pegou só uma amostra). Lista completa abaixo.

- [x] 4.1 Reverter `src/app/owner/contracts/page.tsx` para componentes Shadcn
- [x] 4.2 Reverter `src/app/owner/contracts/new/page.tsx` para componentes Shadcn
- [x] 4.3 Reverter `src/app/owner/settings/page.tsx` para componentes Shadcn
- [x] 4.4 Reverter `src/app/owner/tenants/page.tsx` para componentes Shadcn
- [x] 4.4.1 Reverter `src/app/owner/tenants/[id]/page.tsx`
- [x] 4.4.2 Reverter `src/app/owner/properties/page.tsx`
- [x] 4.4.3 Reverter `src/app/owner/properties/new/page.tsx`
- [x] 4.4.4 Reverter `src/app/owner/properties/[id]/page.tsx`
- [x] 4.4.5 Reverter `src/app/properties/page.tsx`
- [x] 4.4.6 Reverter `src/app/login/page.tsx`
- [x] 4.4.7 Reverter `src/components/dashboard/StatsCards.tsx`
- [x] 4.4.8 Reverter `src/components/dashboard/FinancialSummary.tsx`
- [x] 4.4.9 Reverter `src/components/dashboard/RecentActivity.tsx`
- [x] 4.5 Buscar por `@heroui` em `frontend/src` e confirmar zero ocorrências — confirmado, zero matches em código (só o import CSS, removido em 4.6)
- [x] 4.6 Removido `@heroui/react`/`@heroui/styles` de `package.json`, `@import "@heroui/styles"` de `globals.css`, `npm install` rodado (40 pacotes removidos). Também removida dependência `cn` redundante (CLI do shadcn insiste em re-adicioná-la; componentes usam `@/lib/utils` como o resto do projeto)

## 5. Remapeamento das demais telas

> Escopo real descoberto na implementação: não era por domínio (dashboard/properties/tenants/financeiro/support/login — esses já foram resolvidos na seção 4, eram HeroUI). O que sobrou são **duas ondas separadas**:
> (a) 6 arquivos com cores Tailwind cruas (`zinc-`/`slate-`/`gray-`) em vez de tokens semânticos;
> (b) 17 arquivos usando o vocabulário antigo de alias MD3/HeroUI (`bg-surface`, `border-outline`, `surface-container-*`, `on-surface*`) que ainda resolvia via `@theme inline` mas apontava pra paleta cinza antiga, nunca pro kit novo.

- [x] 5.1 Onda (a) — cores cruas: `expenses/page.tsx`, `leases/page.tsx`, `payments/page.tsx` (zinc-* → tokens semânticos), `settings/team/TeamClient.tsx`, `units/[id]/page.tsx`, `components/leases/LeaseForm.tsx` (gray-* → tokens). Cores categóricas intencionais (status/categoria: green/orange/red/purple/blue/amber, e verde do WhatsApp `#25D366`) mantidas — não são tokens de superfície
- [x] 5.2 Onda (b) — alias MD3 antigo: todos os 6 arquivos de `/financial/*`, `settings/financial/*` (2), `settings/profile`, `settings/team` (restante), `support/*` (5), `Header.tsx`, `app/page.tsx` (dashboard raiz) remapeados pra tokens diretos (`bg-surface`→`bg-background`/`bg-card`, `border-outline-variant`→`border-border`, `text-on-surface-variant`→`text-muted-foreground`, etc.)
- [x] 5.3 Removido de `globals.css` o bloco de vars "HeroUI surface system" (`--surface`, `--container`, `--inverse-*`, `--content`, `--divider`, `--focus-ring`, `--overlay`) e o bloco "Utility aliases" em `@theme inline` (`--color-surface`, `--color-outline*`, `--color-surface-container-*`) — zero referências restantes em `src/`, confirmado via grep
- [x] 5.4 Confirmado: `--chart-*` (usado só por `components/ui/chart.tsx`, valores não sincronizados do kit — deferido, ver design.md) e `--sidebar-*` (usado por `components/Sidebar.tsx`, kit não tem componente de sidebar) mantidos intactos, fora de escopo

## 6. Validação final

- [ ] 6.1 `npm run lint` sem erros novos (confirmado: 73 problemas, todos pré-existentes, mesmos 4 `no-explicit-any` de antes). `npm run build` **não fica 100% verde** — `next build` roda type-check completo do projeto e aborta no primeiro erro de TS que encontra; achei e corrigi 4 bugs pré-existentes de tipagem (não relacionados a UI, só desbloqueando a verificação): `CreateLeaseDialog.tsx` (Tenant/Property mais estritos que o necessário), `payments/page.tsx` (mesmo padrão com Lease), `FinancialForm.tsx` (`unknown || ''` virando tipo `{}`). Ao corrigir esses, o build avançou e achou um **5º erro não relacionado** em `units/[id]/page.tsx:102` (`activeLease` tipado como `never`) — não é algo introduzido por mim (confirmado via `git diff`, só mudei uma className numa branch diferente do arquivo) e não é o último; é um padrão sistêmico de type-check nunca ter sido rodado limpo neste projeto. Parei de caçar — isso é débito técnico pré-existente, merece sua própria change, não cabe dentro de "migrar UI kit"
- [x] 6.2 Checagem via `curl` (sem browser/screenshot disponível): todas as rotas convertidas respondem 200 — `/`, `/properties`, `/owner/properties`, `/owner/tenants`, `/owner/settings`, `/owner/contracts`, `/financial/dashboard`, `/support`, `/login`. Nenhum crash de runtime em nenhum domínio tocado. Checagem visual pixel-a-pixel fica pro usuário
- [x] 6.3 Confirmado: nenhuma lógica de Server Action/DAL/Zod foi alterada — só JSX/className/imports de componente trocados. As únicas mudanças de "lógica" foram os 4 fixes de tipagem do item 6.1 (TypeScript puro, zero mudança de comportamento em runtime)

## Context

O canvas "ImoviFlow — Telas" é a fonte da verdade do redesign. Estado atual do frontend, verificado no repo:

- `layout.tsx` já carrega Urbanist (`@fontsource-variable`, via `localFont`) e Geist Mono. O canvas pede Space Mono.
- `globals.css` tem tokens extraídos do UI Kit do Figma antigo. Diferenças em relação ao canvas:
  - Claro: `background` `#fefefc` (canvas `#ffffff`); `accent` `#f4f5f1` (canvas `#e0e7ff`); sem `success`/`warning`; charts diferentes.
  - Escuro: `background` `#1b1b1b` (canvas `#18181b`); `primary` `#4da3ff` (canvas `#4f46e5`); `secondary`/`accent` laranja `#ffb77d` (canvas `#1e1f3a`/`#312e81`).
- O shell (`AppShell`, `AppSidebar`, `TopBar`, `CommandPalette`, `theme-provider`) existe sem commit, com testes. O `layout.tsx` usa `Header` + `AppSidebar`. `Header` é um wrapper de servidor que renderiza o `TopBar` com sessão e um botão "Entrar" sem sessão; `AppSidebar` é o wrapper de servidor que carrega organização e perfil para o `Sidebar` (cliente, a sidebar real). O `AppShell` tem um ramo de visitante que o canvas não desenha.
- `nav.ts` segue o Figma antigo (Gestão / Financeiro / Administrativo) e inclui Laudos.
- Rotas existentes: `/financial/*`, `/import`, `/settings/*`, `/inspections/*`. Não existem `/integrations` nem `/reports`.

## Goals / Non-Goals

**Goals:**
- `globals.css` reflete `tokens.json` do canvas nos dois temas.
- Um único shell autenticado, testado, com navegação do canvas (desktop e mobile).
- Dark mode funcional.
- Shell sem modo visitante.
- Base estável para as ondas de telas, sem tocar em conteúdo de página.

**Non-Goals:**
- Reimplementar telas de Imóveis, Inquilinos, Contratos, etc.
- Mover ou renomear rotas existentes.
- Modo visitante.
- Qualquer mudança de backend.
- Tela de Laudos.
- Corrigir o contraste do `ring` escuro (anotar apenas).

## Decisions

**1. Tokens: copiar valores do `tokens.json` literalmente para `globals.css`, mantendo a estrutura atual.**
O arquivo já tem `:root`, `.dark` e `@theme inline`; só os valores mudam e entram `--success` e `--warning` (com `--color-*` no `@theme`). Alternativa descartada: gerar o CSS por script a partir do JSON; são ~35 variáveis e o JSON não é versionado no repo, então o ganho não compensa.

**2. Shadows e radius: aplicar a escala do canvas só onde o `ui/*` atual já usa tokens.**
Não editar classes base dos componentes (regra "copiar fiel" do `design-system.md`). Se um componente divergir visualmente do canvas, vira ajuste separado e documentado.

**3. Fonte mono: trocar para Space Mono via `@fontsource`, mesmo mecanismo do Urbanist.**
`next/font/google` fica fora por quebrar o dev no container (commit `560de75`). Se `@fontsource/space-mono` não for variável, carregar os pesos 400 e 700 por `localFont`.

**4. Shell: sem modo visitante, mantendo `Header`, `TopBar`, `AppSidebar` e `Sidebar`.**
O canvas não desenha estado de visitante, e o shell passa a assumir sessão. Sem sessão, o middleware redireciona para `/login`. Saem apenas o botão "Entrar" do `Header` e o ramo `!sidebar` do `AppShell`. Nenhum arquivo é apagado: `Sidebar` é a sidebar real, e `Header` fica como wrapper do `TopBar`. O `TopBar` mantém a paleta ⌘K e o toggle de tema, que o canvas exige.

**5. Navegação em `nav.ts` como dado único, com dois consumidores: sidebar desktop e mobile.**
Fonte: `Importar-1-arquivo.dc.html` (sidebar), `Mobile.dc.html` e `M-Mais.dc.html`.
- Desktop, 3 grupos: Gestão (Hoje, Imóveis, Inquilinos, Contratos), Financeiro (Recebimentos, Despesas, Relatórios), Administrativo (Integrações, Configurações). O cabeçalho da sidebar mostra ImoviFlow e o plano; o rodapé mostra o usuário.
- Mobile, barra inferior com 5 abas: Hoje, Imóveis, Inquilinos, Receber, Mais. "Mais" lista Despesas, Relatórios, Contratos, Integrações, Configurações, o usuário e Sair.
Alternativa descartada: duas listas separadas; elas divergiriam. O nav.ts marca quais itens vão para a barra inferior, e os demais caem em "Mais".

**6. Mapeamento menu → rota, sem mover rotas:**

| Item | Destino |
|---|---|
| Hoje | `/` |
| Imóveis | `/properties` |
| Inquilinos | `/tenants` |
| Contratos | `/leases` |
| Recebimentos | `/financial/receivables` |
| Despesas | `/financial/payables` |
| Relatórios | `/reports` (placeholder) |
| Integrações | `/integrations` (placeholder) |
| Configurações | `/settings` |

Importar, Documentos e Fechamento não têm item de menu no canvas. `/import` continua existindo e fica acessível por URL até a Onda 1, quando Inquilinos e Imóveis ganham o botão de importar (o canvas abre Importar com Inquilinos ativo e o seletor Inquilinos/Imóveis). Documentos vive dentro do detalhe do inquilino, e Fechamento será ligado a partir de Recebimentos ou Hoje, a confirmar nas ondas dessas telas. Os destinos de Recebimentos e Despesas serão revistos na Onda 1.

**7. Placeholders: um componente `ComingSoon` simples, usando só `ui/*` existentes.**
Só para `/reports` e `/integrations`, que têm item de menu. Sem lógica nem dados. Alternativa: esconder os itens até existirem; descartada porque o canvas define a navegação.

**8. Laudos: remover do menu e da paleta, manter rotas.**
Sem dado perdido; o acesso volta quando o canvas tiver a tela. A paleta ⌘K também não deve listar Laudos, para não reabrir pela porta dos fundos.

## Risks / Trade-offs

- [Mudar o `primary` escuro de `#4da3ff` para `#4f46e5` altera todas as telas já migradas] → Revisar visualmente dashboard, listas e laudos no tema escuro antes do merge; reverter por variável se algo quebrar.
- [Shell sem commit com testes possivelmente quebrados] → Rodar `make frontend-lint` e a suíte Vitest antes de qualquer ajuste; corrigir só o que bloqueia.
- [Contraste do `ring` escuro a 2,8:1, abaixo de 3:1] → Manter o valor do kit e registrar em tasks como pendência para o design.
- [Componentes `ui/*` novos podem ter vindo sem passar pelo `shadcnds`] → Conferir cada um (`sidebar`, `sheet`, `command`, `tooltip`, `kbd`, `theme-toggle`) contra o `shadcnds` e anotar divergências; não reestilizar na mesma tarefa.
- [Item de menu sem página soa como funcionalidade pronta] → Placeholder deixa claro "em breve" e não chama API.
- [Preset do `shadcnds` (radix-nova) difere do frontend (new-york)] → Conferir no navegador depois de copiar, como já manda o `design-system.md`.

## Open Questions

- Onde Fechamento do mês é aberto na navegação (Hoje ou Recebimentos)? Fica para a onda dessa tela.
- Importar entra pelo botão em Inquilinos e Imóveis (canvas `Importar-1-arquivo`). Confirmar o desenho do botão quando essas telas forem feitas.

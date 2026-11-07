## Why

O redesign do frontend usa o canvas "ImoviFlow — Telas" (107 artboards, 16 fluxos) como fonte da verdade. Toda tela depende de dois alicerces que hoje divergem do canvas: os tokens visuais (`globals.css`) e o shell de navegação (`nav.ts`, `AppShell`, sidebar/topbar). Fechar isso antes das telas evita retrabalho em cada onda seguinte.

## What Changes

- Alinhar `globals.css` aos tokens do canvas (`project/ds/imoviflow/tokens.json`): cores claro/escuro, `accent`, `success`, `warning`, charts, raios e sombras. Fonte mono passa de Geist Mono para Space Mono. Urbanist já está carregada.
- Fechar o shell que está sem commit (`AppShell`, `AppSidebar`, `TopBar`, `CommandPalette`, `theme-provider`, `ui/sidebar`, `ui/sheet`, `ui/command`, `ui/tooltip`, `ui/kbd`, `ui/theme-toggle`) e garantir que seus testes passam.
- Reescrever `lib/nav.ts` conforme a sidebar do canvas, em 3 grupos: Gestão (Hoje, Imóveis, Inquilinos, Contratos), Financeiro (Recebimentos, Despesas, Relatórios) e Administrativo (Integrações, Configurações). Importar, Documentos e Fechamento não têm item de menu no canvas.
- Navegação mobile do canvas: barra inferior com 5 abas (Hoje, Imóveis, Inquilinos, Receber, Mais) e tela "Mais" (Despesas, Relatórios, Contratos, Integrações, Configurações, usuário e Sair).
- Remover o modo visitante do shell: sem sessão, o middleware redireciona para `/login`.
- **BREAKING** (menu): Laudos sai do menu até existir tela no canvas. As rotas `/inspections/*` continuam funcionando, só não aparecem na navegação.
- **BREAKING** (menu): "Dashboard", "Contas a Receber", "Contas a Pagar" e "Importar" saem do menu e entram Hoje, Recebimentos, Despesas e Relatórios. Só rótulo e destino do menu mudam; as rotas existentes (`/financial/*`, `/import`) não são movidas aqui.
- Rotas do canvas com item de menu e sem página (`/integrations`, `/reports`): página placeholder simples, sem lógica.
- Dark mode funcional com toggle; contraste do `ring` escuro anotado, sem alterar o valor.
- Separar o trabalho do shell do branch `feat/add-laudo-vistoria`.

Fora de escopo: telas de conteúdo (Imóveis, Inquilinos etc.), mudança de rotas existentes, backend, tela de Laudos, modo visitante, e os pontos de entrada de Importar, Documentos e Fechamento (chegam com as telas dos seus fluxos).

## Capabilities

### New Capabilities
- `design-tokens`: tokens de cor, tipografia, raio e sombra do canvas aplicados em `globals.css`, com temas claro e escuro.
- `app-shell-navigation`: shell autenticado (sidebar desktop, drawer/barra inferior mobile, topbar, paleta de comandos ⌘K, toggle de tema) e a estrutura de navegação derivada do canvas.

### Modified Capabilities
<!-- Nenhum requisito de spec existente muda. `frontend-shadcn-only` segue valendo. -->

## Impact

- Código: `frontend/src/app/globals.css`, `app/layout.tsx`, `lib/nav.ts`, `components/{AppShell,AppSidebar,TopBar,CommandPalette,theme-provider}.tsx`, `components/ui/{sidebar,sheet,command,tooltip,kbd,theme-toggle}.tsx`, `hooks/use-mobile.ts`, `middleware.ts`, `lib/session.ts`, testes em `src/__tests__/`.
- Páginas placeholder novas: `frontend/src/app/reports/` e `frontend/src/app/integrations/`.
- Dependências: `frontend/package.json` já alterado (verificar o que foi adicionado, por exemplo `next-themes`, `cmdk`, `@fontsource-variable/*`).
- Sem mudança em backend, API ou banco.
- Componentes `ui/*` novos devem vir do `shadcnds` conforme `.claude/rules/design-system.md`; conferir a origem de cada um.

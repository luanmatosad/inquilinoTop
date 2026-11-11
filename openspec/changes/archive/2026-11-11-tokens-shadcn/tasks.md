## 1. Pré-requisitos do Figma

- [x] 1.1 Valores do modo Dark obtidos de `figma-exports/Dark.tokens.json` (export de 331 folhas de cor, 19:33). Divergências do Figma ficam explícitas em 2.2.
- [x] 1.2 Token `input` alterado no Figma para `#8f8f96` no modo light. `Light.tokens.json` confirma. `Dark.tokens.json` (19:33) ainda tem `input` = `#242427`: confirmar se o Figma dark foi alterado depois do export.

## 2. Cores semânticas

- [x] 2.1 `:root`/`[data-theme="light"]` em `frontend/src/app/globals.css` conferido contra `figma-exports/Light.tokens.json`: 33 variáveis batem exatamente.
- [x] 2.2 `.dark`/`[data-theme="dark"]` alinhado a `figma-exports/Dark.tokens.json`. Bate: background, foreground, card, popover, primary, secondary, muted, accent, destructive, success, warning, border, sidebar-*, chart-1..5. Dois desvios deliberados, a confirmar:
  - `--input`: Figma dark = `#242427` (1.14:1 sobre `#18181b`, falha WCAG 1.4.11). Mantido `#8f8f96` (spec).
  - `--ring`: Figma dark = `#4f46e5` (2.82:1 sobre `#18181b`, abaixo de 3:1). Mantido `#818cf8` (5.94:1, WCAG 2.4.7).
- [x] 2.3 `--input` = `#8f8f96` nos dois modos.
- [x] 2.4 Comentários "fora do Figma" removidos: todos os tokens semânticos (accent, destructive, warning, ring, chart-*, sidebar-*) estão nos exports light e dark. A leitura anterior do MCP veio incompleta e marcou esses tokens como ausentes.

## 3. Tipografia, espaçamento, radius, sombra

- [x] 3.1 Declarar família Urbanist e escala de tamanho em `@theme inline`, com `text-xs` = 14px (`text-base` 16px; `text-lg` não declarado)
- [x] 3.2 Declarar pesos 400/500/600/700 e line-heights do Figma
- [x] 3.3 Declarar escala de radius com `--radius` = 0.5rem (8px) e tokens sm, md, lg, xl, 2xl, 3xl, full (`--radius-4xl` mantido, sem uso mapeado no Figma)
- [x] 3.4 Converter `shadow/xs` e `shadow/base` do Figma para `--shadow-xs` e `--shadow-base` em `box-shadow`
- [x] 3.5 Normalizar `opacity-50` para `0.5` e nomes com vírgula para ponto (nada a alterar: Tailwind já usa fração e ponto)

## 4. Verificação

- [x] 4.1 `cd frontend && npm run lint` (limpo)
- [x] 4.2 `cd frontend && npm run build` (compilou, 40/40 páginas; logs `DYNAMIC_SERVER_USAGE` são de rotas com `cookies`, não do CSS)
- [x] 4.3 Smoke visual no container Docker rebuildado (`inquilinotop-frontend`): leases e tenants em light e dark. Light: `input` border `rgb(143,143,150)`, `text-xs` 14px, body `#ffffff`. Dark (em `/leases`): body `rgb(24,24,27)`, `input` border `rgb(143,143,150)`, `--chart-2` `#e6ef60`, `--sidebar` `#242427`, `--ring` `#818cf8`. Dark obtido pelo botão "Alternar tema" real.
- [x] 4.4 Contraste de `input` (WCAG 1.4.11, calculado): `#8f8f96` = 3.21:1 sobre `#ffffff`, 3.18:1 sobre `#fefefc`, 5.52:1 sobre `#18181b`, 4.82:1 sobre `#242427`. Todos acima de 3:1.

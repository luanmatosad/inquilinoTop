# Proposal

## Why

O Figma (UI Kit ImoviFlow, node 5984:59776) é a fonte da verdade do design, mas o tema atual em `frontend/src/app/globals.css` só cobre cores semânticas shadcn (light e dark escritos à mão). Tipografia, espaçamento, radius e sombras do Figma não existem no código, e o dark não é validado contra o design. Precisamos de um único conjunto de tokens derivado do Figma.

## What Changes

- Adicionar em `globals.css` (`@theme inline`) os tokens não-cor do Figma: família Urbanist, escala tipográfica (12–128px, line-height, pesos 400/500/600/700), grid de espaçamento de 4px, escala de radius (none 0 … full 9999) e sombras `xs` e `base`, convertidas de Effect para `box-shadow`.
- Alinhar os valores de cor semântica light ao Figma, que é a fonte da verdade.
- `--input` = `#8f8f96` nos dois modos. Já é o valor do CSS. O token `input` no Figma (hoje `#fefefc`, contraste 1.01:1 sobre `#ffffff`) será alterado para o mesmo valor, manualmente, pois o MCP é somente leitura. Contraste: 3.21:1 sobre `#ffffff`, 3.18:1 sobre `#fefefc`, 5.52:1 sobre `#18181b` (WCAG 1.4.11, mínimo 3:1).
- `Browser Config/Responsive/Scale-xs` é descartado. `text-xs` passa a 14px.
- Converter `Effects/Opacity/opacity-50` de percentual (`50`) para fração (`0.5`) ao gerar utilitários.
- Normalizar nomes de tokens com vírgula (`0,5`, `1,5`, `2,5`) para `0.5`, `1.5`, `2.5`.
- Tokens que existem só no CSS atual e não estão no Figma (`accent`, `destructive`, `warning`, `ring`, `chart-*`, `sidebar-*`) são mantidos como extensão, documentados como "fora do Figma" e marcados para revisão.
- Modo Dark: o MCP do Figma retorna apenas o modo padrão, mesmo ao consultar frames diferentes. Os valores dark atuais do CSS ficam até o usuário indicar um frame em modo Dark ou exportar os valores.
- Remover a referência morta a `project/ds/imoviflow/tokens.json` em `globals.css` (arquivo inexistente). Já feito.

**BREAKING**: `text-xs` passa de 12px para 14px. Telas que usam esse token mudam de aparência.

## Capabilities

### New Capabilities

- `design-tokens`: fonte única de tokens (cor semântica light/dark, tipografia, espaçamento, radius, sombra) derivada do Figma, expostos como CSS variables e utilitários Tailwind.

### Modified Capabilities

<!-- Nenhuma spec existente de UI cobre tokens. -->

## Impact

- `frontend/src/app/globals.css`: única fonte de tokens (sem gerador, sem dependência nova).
- Componentes que usam `text-xs` e sombras: revisão visual necessária.
- `frontend/src/components/ui/`: não modificar (regra do projeto); mudança só via tokens.
- Figma: token `input` alterado manualmente para `#8f8f96`.
- Sem mudança de backend.

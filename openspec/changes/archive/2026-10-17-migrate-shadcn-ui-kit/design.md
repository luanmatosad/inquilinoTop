## Context

O frontend hoje tem duas libs de UI convivendo: Shadcn/UI (`src/components/ui/*`, configurado em `components.json` — style `new-york`, `baseColor` `neutral`, `cssVariables: true`) e HeroUI (`@heroui/react`, `@heroui/styles`), instalada pela change `migrate-frontend-to-heroui` mas só aplicada em 4 páginas (`owner/contracts`, `owner/contracts/new`, `owner/settings`, `owner/tenants`). O resto do app continua em Shadcn.

Existe um novo UI Kit no Figma (`fomyYYvs8CSveLZs2x2oMS`) com ~30 páginas de componentes primitivos Shadcn-based (Bubble, Message, Marker, Icon, Image, Utility, Label, Title, Description, Button, Collapsible, Aspect Ratio, Separator, Menu Item, Dropdown Menu, Menubar, Popover, Field, Input, Input Group, Textarea, Checkbox, Radio Group, Card, Item, Avatar, Charts (Area/Bar/Pie/Radar/Radial), Spinner). É um kit de design system, não telas do app — a adaptação das telas reais é trabalho de remapeamento, não de "puxar tela pronta".

Nesta sessão não há servidor MCP do shadcn conectado (verificado `.mcp.json` e registry de ferramentas) — só o Figma MCP (leitura de design). O shadcn MCP (`npx shadcn@latest mcp` ou equivalente registry oficial) precisa ser configurado para puxar componentes/tokens via comando, complementando a leitura visual do Figma MCP.

## Goals / Non-Goals

**Goals:**
- Um único sistema de componentes (Shadcn) em todo o frontend
- Tokens de design (cor, radius, spacing, tipografia) centralizados e vindos do novo kit Figma
- Fluxo repetível para trazer componentes do kit Figma para o código via shadcn MCP + Figma MCP
- Zero regressão de lógica — Server Actions, DAL, Zod schemas, bindings Supabase/Go inalterados

**Non-Goals:**
- Não migra lógica de domínio Supabase → Go (isso é outra frente, já coberta pelas regras de `frontend.md`)
- Não redesenha fluxos/IA de telas — reaplica os componentes novos na estrutura de página existente
- Não cobre testes E2E visuais automatizados (fora de escopo desta change)

## Decisions

**1. Shadcn como padrão único, HeroUI removido por completo**
Alternativa considerada: manter HeroUI nas 4 páginas já migradas e só aplicar o kit novo no restante. Rejeitada — manter duas libs de componentes é a causa raiz da inconsistência atual; decisão do usuário foi reverter de vez.

**2. Adicionar shadcn MCP como servidor complementar ao Figma MCP**
Figma MCP lê o design visual (screenshot, metadata, design tokens via `get_variable_defs`). Shadcn MCP resolve definições de componente (props, variantes, código-fonte canônico do registry) por nome, evitando reimplementação manual componente a componente. Os dois se complementam: Figma MCP diz "o que o design pede visualmente", shadcn MCP diz "qual é a implementação de referência do componente".

**3. Tokens via CSS variables, não hardcoded em componentes**
`components.json` já tem `cssVariables: true`. Os tokens extraídos do Figma (cor, radius, spacing) vão para `globals.css` como CSS vars, nunca inline nos componentes — mantém o padrão já estabelecido no projeto e permite trocar tema sem tocar em componente.

**4. Ordem de execução: tokens → componentes base → revert HeroUI → remapeamento de telas**
Tokens errados invalidam todo trabalho posterior. Componentes base (`ui/*`) precisam estar prontos antes de reverter páginas HeroUI (senão revert usa componente desatualizado). Remapeamento de telas é o item de maior volume e vai por último, domínio por domínio.

## Risks / Trade-offs

- [Revert de HeroUI quebra alguma interação já ajustada nas 4 páginas migradas] → Revisar diff página a página antes de remover `@heroui/react`; não remover a dependência até todas as 4 páginas estarem revertidas e testadas.
- [Shadcn MCP pode não existir/ser instável como servidor oficial] → Validar primeiro com `npx shadcn@latest mcp --help` (ou doc oficial) antes de depender dele; se não disponível, fallback é `npx shadcn@latest add <component>` via CLI normal.
- [Tokens do kit Figma não mapeiam 1:1 pras CSS vars atuais (ex: nomes diferentes de cor)] → Levantar tabela de mapeamento tokens-Figma → CSS-vars antes de aplicar, como primeira task.
- [Remapeamento de telas é grande (10+ páginas) e pode gerar PR gigante] → Dividir tasks por domínio (dashboard, properties, tenants, financeiro, support, admin) para permitir revisão incremental.

## Migration Plan

1. Mapear tokens do kit Figma → CSS vars em `globals.css`
2. Configurar shadcn MCP no projeto
3. Trazer/atualizar componentes em `src/components/ui/*` a partir do kit
4. Reverter as 4 páginas HeroUI para Shadcn
5. Remover `@heroui/react` e `@heroui/styles` do `package.json`
6. Remapear telas restantes, domínio por domínio
7. Rollback: cada etapa é um commit isolado; se o revert HeroUI quebrar algo, reverter só o commit daquela etapa (dependências shadcn/HeroUI não se sobrepõem em runtime, então rollback é seguro por página)

## Open Questions

- Shadcn MCP oficial — qual pacote/comando exato usar? (confirmar na implementação, antes da task de setup)
- Mapeamento de tokens Figma → CSS vars precisa de acesso ao `get_variable_defs` do Figma MCP no kit — confirmar que o kit tem variables definidas (não só valores hardcoded nos componentes)

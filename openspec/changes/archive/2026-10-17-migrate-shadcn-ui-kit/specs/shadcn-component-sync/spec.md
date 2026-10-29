## ADDED Requirements

### Requirement: Fluxo de sincronização de componentes via MCP shadcn + Figma
O sistema SHALL ter um servidor MCP shadcn configurado no projeto, usado em conjunto com o Figma MCP já existente, para trazer definições de componente do UI Kit Figma para `src/components/ui/*`.

#### Scenario: Componente novo trazido do kit
- **WHEN** um componente do kit Figma (ex: Input Group, Item) ainda não existe em `src/components/ui/*`
- **THEN** o componente é adicionado via shadcn MCP/CLI e ajustado visualmente conforme o design de referência obtido pelo Figma MCP

#### Scenario: Componente existente atualizado
- **WHEN** um componente já existe em `src/components/ui/*` mas difere do novo kit (ex: variantes, props)
- **THEN** o componente é atualizado para refletir as variantes e tokens do novo kit, sem quebrar os usos existentes nas páginas que o consomem

### Requirement: Única biblioteca de componentes no frontend
O sistema SHALL usar exclusivamente Shadcn/UI como biblioteca de componentes — nenhuma página SHALL importar componentes de `@heroui/react`.

#### Scenario: Página revertida de HeroUI
- **WHEN** uma página que antes usava `@heroui/react` (ex: `owner/contracts`, `owner/settings`, `owner/tenants`, `owner/contracts/new`) é revisitada
- **THEN** ela usa exclusivamente componentes de `src/components/ui/*` (Shadcn), com o mesmo comportamento funcional de antes

#### Scenario: Nenhuma página restante usa HeroUI
- **WHEN** a migração está completa
- **THEN** uma busca por `@heroui` no diretório `frontend/src` não retorna nenhuma ocorrência

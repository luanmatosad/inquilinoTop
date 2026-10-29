## Why

A migração para HeroUI (`migrate-frontend-to-heroui`) ficou pela metade: 13 arquivos usam `@heroui/react` (`owner/contracts`, `owner/contracts/new`, `owner/settings`, `owner/tenants`, `owner/tenants/[id]`, `owner/properties`, `owner/properties/new`, `owner/properties/[id]`, `properties`, `login`, e os 3 componentes de dashboard `StatsCards`/`FinancialSummary`/`RecentActivity`), o resto do app ainda usa Shadcn/UI. As duas libs convivem no `package.json`, gerando inconsistência visual e duplicação de dependências. O usuário criou um novo UI Kit Shadcn no Figma (tokens + ~30 componentes primitivos: Button, Card, Input, Dropdown Menu, Charts, Avatar, etc.) e decidiu reverter de vez para Shadcn como padrão único do frontend.

## What Changes

- Reverter as 4 páginas HeroUI para Shadcn/UI (`owner/contracts`, `owner/contracts/new`, `owner/settings`, `owner/tenants`)
- **BREAKING**: Remover dependências `@heroui/react` e `@heroui/styles` do `package.json`
- Adicionar servidor MCP oficial do shadcn (registry) à configuração do projeto, para puxar definições de componentes diretamente no fluxo de trabalho
- Sincronizar design tokens (cores, radius, spacing, tipografia) do novo kit Figma para `src/app/globals.css` / config Tailwind
- Atualizar `src/components/ui/*` com os componentes do novo kit (mantendo aliases/estrutura já configurada em `components.json`)
- Remapear as demais telas do app (dashboard, properties, tenants, financeiro, support, admin/owner settings) para consumir os componentes/tokens novos
- Nenhuma mudança em lógica de dados, Server Actions, DAL ou bindings Supabase/Go — troca é só de camada de apresentação

## Capabilities

### New Capabilities
- `shadcn-design-tokens`: Tokens de cor, radius, spacing e tipografia do novo UI Kit Figma aplicados via CSS variables no Tailwind, substituindo os tokens atuais.
- `shadcn-component-sync`: Fluxo (via MCP shadcn + Figma MCP) para trazer componentes e variantes do kit Figma para `src/components/ui/*` mantendo paridade visual com o design.

### Modified Capabilities
- Nenhuma — não há specs existentes em `openspec/specs/` para este domínio ainda.

## Impact

- `frontend/package.json`: remove `@heroui/react`, `@heroui/styles`
- `frontend/src/components/ui/*`: componentes atualizados/substituídos pelo novo kit
- `frontend/src/app/globals.css`: tokens de tema atualizados
- `frontend/src/app/owner/contracts/page.tsx`, `contracts/new/page.tsx`, `settings/page.tsx`, `tenants/page.tsx`: revertidas de HeroUI para Shadcn
- Todas as demais páginas do app: remapeadas para os componentes/tokens novos (sem mudança de lógica)
- Configuração MCP do projeto: novo servidor shadcn registry

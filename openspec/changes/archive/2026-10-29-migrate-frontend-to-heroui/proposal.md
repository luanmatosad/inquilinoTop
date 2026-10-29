## Why

O frontend atual usa shadcn/ui + Tailwind CSS com um design system manual. O objetivo é migrar para **HeroUI** (@heroui/react) para ter componentes modernos e vibrantes padronizados, mantendo toda a lógica existente (server actions, DAL, bindings Supabase).

## What Changes

- Instalar `@heroui/react` como dependência principal de componentes UI
- Substituir componentes `src/components/ui/*` (shadcn) por componentes HeroUI equivalentes
- Aplicar design tokens do `docs/frontend/inquilinotop_core/DESIGN.md` via theme provider
- **Manter**: server actions, DAL, bindings Supabase, middleware, schemas Zod
- Migrar 6 telas: Login, Dashboard, Imóveis, Detalhes Imóvel, Inquilinos, Detalhes Unidade

## Capabilities

### New Capabilities

- `login-screen`: Tela de login com tabs Entrar/Cadastrar, campos email/senha, toggle password visibility
- `dashboard-screen`: Stats cards bento grid, financial summary bar, recent activity list
- `properties-screen`: Property grid cards com search/filter, imagem + dados + occupied count
- `property-details-screen`: Imagem principal, occupation stats, units table com pagination
- `tenants-screen`: Table com avatar, name, email, phone, cpf/cnpj, status badge, ações
- `unit-details-screen`: Tenant card, receipts table, contract summary card, quick actions

### Modified Capabilities

- Nenhum. Todas as telas são novas implementações com design HeroUI

## Impact

- `frontend/package.json`: Adicionar `@heroui/react`
- `frontend/src/components/ui/*`: Substituir por componentes HeroUI
- `frontend/src/app/*`: Manter inalterado (lógica intacta)
- `frontend/src/data/*`: Manter inalterado (DAL intacto)
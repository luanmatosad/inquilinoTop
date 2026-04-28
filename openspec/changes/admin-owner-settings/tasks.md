## 1. Property Management

- [x] 1.1 Criar tabela/campos de imóveis no Supabase (se não existir) e configurar RLS por owner_id
- [x] 1.2 Criar DAL em `src/data/owner/properties-dal.ts` (listar, criar, atualizar)
- [x] 1.3 Criar página de listagem em `src/app/(dashboard)/owner/properties/page.tsx`
- [x] 1.4 Criar formulário de cadastro de imóvel (componente)
- [x] 1.5 Criar página de detalhes/edição do imóvel

## 2. Tenant Management

- [x] 2.1 Mapear estrutura de dados de inquilinos no Supabase
- [x] 2.2 Criar DAL em `src/data/owner/tenants-dal.ts`
- [x] 2.3 Criar página de listagem de inquilinos
- [x] 2.4 Criar página de detalhes do inquilino com histórico e contratos vinculados

## 3. Contract Management

- [x] 3.1 Mapear/criar tabela de contratos no Supabase (contratos vinculados a imóvel + inquilino)
- [x] 3.2 Criar DAL em `src/data/owner/contracts-dal.ts`
- [x] 3.3 Criar página de listagem de contratos com status (Ativo/Encerrado/Em Atraso)
- [x] 3.4 Criar formulário de registro de novo contrato
- [x] 3.5 Integrar criação de contrato com update de status do imóvel (alugado/vazio)

## 4. Owner Preferences

- [x] 4.1 Criar estrutura de preferências/notificações no Supabase (tabela owner_settings)
- [x] 4.2 Criar DAL em `src/data/owner/preferences-dal.ts`
- [x] 4.3 Criar página de configurações em `src/app/(dashboard)/owner/settings/page.tsx`
- [x] 4.4 Implementar formulário de dados pessoais
- [x] 4.5 Implementar toggles de preferências de notificação
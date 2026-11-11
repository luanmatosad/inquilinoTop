## Why

O sistema atual não suporta imobiliárias com múltiplos funcionários. Existe apenas um role `owner` que tem acesso total, sem hierarquia ou estrutura organizacional. Isso impede o uso do sistema por imobiliárias que precisam delegar tarefas — um gerente não pode gerenciar corretores, e um corretor não pode ver apenas seus próprios imóveis atribuídos.

## What Changes

- Novo modelo de **Organização (Imobiliária)** com hierarquia de usuários
- Tabela `organizations` para representar cada imobiliária/cliente
- Tabela `organization_members` ligando usuários à organização com roles
- Modelo de **Filiais (branches)** para estruturar equipes por região/setor
- Novos roles hierárquicos: `owner` → `admin` → `manager` → `employee` → `viewer`
- Roles podem ser globais (org-wide) ou escopados a uma filial
- Integração do middleware RBAC existente nas rotas de domínio
- Propriedades passam a pertencer à organização, não diretamente ao owner
- API para convidar/remover funcionários
- UI de gerenciamento de equipe nas configurações

## Capabilities

### New Capabilities

- `organization-model`: Representa a imobiliária/organização como entidade raiz. Toda propriedade, usuário e dado pertence a uma organização.
- `branch-management`: Filiais como subdivisões da organização (regiões, escritórios). Roles podem ser globais ou escopados a filial.
- `member-invitation`: Fluxo de convite por email para adicionar funcionários à organização com role específico.
- `hierarchical-rbac`: Roles hierárquicos com herança — `admin` herda permissões de `manager`, que herda de `employee`, etc. Permissões definidas por capability/action (não por domínio).
- `rbac-middleware-integration`: Middleware de autorização integrado em todas as rotas de domínio, verificando role + scope (org ou branch) antes de executar handler.

## Impact

- **Backend**: Nova migration (`000026`), novos modelos `organization`, `branch`, `organization_member`. Atualização em `rbac/model.go`, `rbac/middleware.go`, `rbac/service.go`, `rbac/handler.go`. Atualização em todos os domain handlers para usar `organizationID` ao invés de `ownerID`.
- **Frontend**: Nova página de gerenciamento de equipe em `/settings/team`. Atualização do context de usuário para incluir `organization` e `roles`. Nova API de convite.
- **Database**: Chave estrangeira de `properties`, `tenants`, `leases`, `payments` e `users` aponta para `organizations`.
- **JWT**: Claims incluem `organization_id` e `branch_id` para contexto de escopo.
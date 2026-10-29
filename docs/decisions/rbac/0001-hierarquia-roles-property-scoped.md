# 0001 - Hierarquia de roles escopada a Property

**Status**: Superseded por [0002](./0002-migracao-organization-id.md)

## Context

Primeira versão do RBAC: usuários precisavam de papéis (owner/admin/viewer) com possibilidade de escopo por imóvel individual, sem conceito de organização/empresa — cada `owner_id` era isolado.

## Decision

`UserRole` com `role` (owner|admin|viewer) e `property_id` opcional — `property_id` nil significa role global (todos os imóveis do owner), `property_id` setado restringe o papel a um imóvel específico.

## Consequences

- RBAC era só gerenciamento de papéis — não havia middleware de autorização aplicado nas rotas de domínio, então ter um role não controlava acesso de fato ainda
- Não havia conceito de equipe/organização — um usuário só podia ter papéis dentro do próprio `owner_id`, sem convite de terceiros
- Essa limitação motivou a decisão [0002](./0002-migracao-organization-id.md): migrar para `organization_id`, acrescentar hierarquia de 5 papéis e aplicar o middleware de permissão de fato

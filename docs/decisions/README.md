# Decisões Arquiteturais (ADR)

Log de decisões técnicas do InquilinoTop, organizado por domínio (espelha `backend/internal/<domínio>/`). Sobrevive ao ciclo de vida das openspec changes — uma change pode ser arquivada, o porquê de uma decisão não deveria se perder com ela.

Template para novas decisões: [`_template.md`](./_template.md).

## Índice

| ID | Título | Status | Domínio | Link |
|---|---|---|---|---|
| identity-0001 | JWT RS256 em vez de HS256 | Accepted | identity | [0001-jwt-rs256.md](./identity/0001-jwt-rs256.md) |
| identity-0002 | Refresh token hash SHA-256 + fluxo 2FA com temp_token | Accepted | identity | [0002-refresh-token-hash-2fa-temp-token.md](./identity/0002-refresh-token-hash-2fa-temp-token.md) |
| rbac-0001 | Hierarquia de roles escopada a Property | Superseded | rbac | [0001-hierarquia-roles-property-scoped.md](./rbac/0001-hierarquia-roles-property-scoped.md) |
| rbac-0002 | Migração de domínios para organization_id | Accepted | rbac | [0002-migracao-organization-id.md](./rbac/0002-migracao-organization-id.md) |
| property-0001 | SINGLE auto-cria Unit | Accepted | property | [0001-single-auto-cria-unit.md](./property/0001-single-auto-cria-unit.md) |
| payment-0001 | Payment imutável (sem Delete) | Accepted | payment | [0001-payment-imutavel-sem-delete.md](./payment/0001-payment-imutavel-sem-delete.md) |
| payment-0002 | Abstração multi-provider (PaymentProvider) | Accepted | payment | [0002-abstracao-multi-provider.md](./payment/0002-abstracao-multi-provider.md) |
| payment-0003 | Cancelamento de cobranças futuras pendentes ao encerrar contrato | Accepted | payment | [0003-cancelamento-de-futuras-pendentes-ao-encerrar-contrato.md](./payment/0003-cancelamento-de-futuras-pendentes-ao-encerrar-contrato.md) |
| audit-0001 | Logs de auditoria imutáveis, sem soft-delete | Accepted | audit | [0001-logs-imutaveis-sem-soft-delete.md](./audit/0001-logs-imutaveis-sem-soft-delete.md) |
| notification-0001 | Separação ListPending / ListByOwner | Accepted | notification | [0001-separacao-listpending-listbyowner.md](./notification/0001-separacao-listpending-listbyowner.md) |
| cross-cutting-0001 | Soft-delete obrigatório em toda entidade | Accepted | _cross-cutting | [0001-soft-delete-obrigatorio.md](./_cross-cutting/0001-soft-delete-obrigatorio.md) |
| cross-cutting-0002 | shadcn/ui como única biblioteca de UI | Accepted | _cross-cutting | [0002-shadcn-ui-unica-biblioteca.md](./_cross-cutting/0002-shadcn-ui-unica-biblioteca.md) |

## Processo para novas decisões

1. Decisão arquitetural relevante tomada numa change (nova dependência, mudança de modelo de dados, trade-off de segurança/performance)
2. Criar `docs/decisions/<domínio>/NNNN-titulo.md` a partir do `_template.md`, numeração sequencial dentro do domínio
3. Adicionar entrada nesta tabela
4. Linkar o ADR na seção "## Decisões" do `CLAUDE.md` do módulo correspondente
5. Decisão que substitui uma anterior: criar ADR novo, marcar o antigo como `Superseded` com link pro novo — nunca editar o conteúdo original silenciosamente

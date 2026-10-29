## ADDED Requirements

### Requirement: Decisões arquiteturais registradas como ADR versionado
O sistema SHALL manter um registro de decisões arquiteturais (ADR) em `docs/decisions/<domínio>/NNNN-titulo.md`, versionado via PR, contendo Status, Context, Decision e Consequences.

#### Scenario: Nova decisão arquitetural relevante
- **WHEN** uma change introduz uma decisão técnica com impacto arquitetural (nova dependência externa, mudança de modelo de dados, trade-off de segurança/performance)
- **THEN** um novo arquivo ADR é criado em `docs/decisions/<domínio>/` com status `Accepted`, numerado sequencialmente dentro do domínio

#### Scenario: Decisão substitui uma anterior
- **WHEN** uma nova decisão invalida ou substitui um ADR existente
- **THEN** o ADR antigo é marcado como `Superseded`, com link para o novo ADR; um novo arquivo é criado em vez de editar o conteúdo original

### Requirement: Índice central de decisões
O sistema SHALL manter `docs/decisions/README.md` listando todos os ADRs (id, título, status, domínio, link).

#### Scenario: Novo ADR criado
- **WHEN** um novo arquivo ADR é adicionado em qualquer domínio
- **THEN** uma entrada correspondente é adicionada em `docs/decisions/README.md`

### Requirement: Backfill de decisões já tomadas
O sistema SHALL ter ADRs de backfill para as decisões arquiteturais já documentadas implicitamente em `CLAUDE.md`/regras do projeto: JWT RS256 (identity), hierarquia RBAC + migração organization_id (rbac), SINGLE auto-cria Unit (property), imutabilidade de Payment (payment), logs de audit imutáveis (audit), separação ListPending/ListByOwner (notification), soft-delete obrigatório (cross-cutting).

#### Scenario: Consulta a decisão histórica
- **WHEN** alguém quer entender por que Payment não tem Delete, ou por que roles RBAC são escopados a Property
- **THEN** encontra o ADR correspondente em `docs/decisions/payment/` ou `docs/decisions/rbac/`, linkado a partir do `CLAUDE.md` do módulo

### Requirement: Link entre módulo e seus ADRs
O sistema SHALL ter, em cada `backend/internal/<domínio>/CLAUDE.md` com ADRs de backfill, uma seção "## Decisões" linkando os ADRs daquele domínio.

#### Scenario: Navegação a partir do módulo
- **WHEN** um desenvolvedor lê `backend/internal/payment/CLAUDE.md`
- **THEN** encontra uma seção "## Decisões" com link para `docs/decisions/payment/0001-...md`

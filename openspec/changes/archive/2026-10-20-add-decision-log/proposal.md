## Why

Decisões técnicas importantes (ex: JWT RS256, soft-delete obrigatório, SINGLE auto-cria Unit, hierarquia RBAC, imutabilidade de Payment) hoje só existem implícitas no código ou em `openspec/changes/*/design.md`. Changes são arquivadas após conclusão, levando a reasoning de design para `openspec/changes/archive/` — difícil de achar meses depois. Falta um log de decisões arquiteturais (ADR) versionado no repo, que sobrevive independente do ciclo de vida de uma change.

## What Changes

- Criar estrutura `docs/decisions/<domínio>/NNNN-titulo.md` (um diretório por domínio, espelhando `backend/internal/<domínio>/`)
- Criar `docs/decisions/README.md` como índice (id, título, status, domínio, link)
- Definir template de ADR: Status, Context, Decision, Consequences
- Backfill de decisões já tomadas e identificáveis no código/docs atuais:
  - `identity`: JWT RS256 + refresh token hash SHA-256 + fluxo 2FA com temp_token
  - `rbac`: hierarquia de roles (owner/admin/viewer) escopada a Property + migração para `organization_id`
  - `property`: SINGLE auto-cria Unit "Unidade 01"
  - `payment`: Payment é imutável (sem Delete), abstração multi-provider (PaymentProvider interface)
  - `audit`: logs são imutáveis (sem soft-delete), `NoopAuditLogger` como default
  - `notification`: separação `ListPending` (sem owner, uso interno) vs `ListByOwner` (API pública)
  - domínio geral: soft-delete obrigatório (`is_active=false`) como invariante cross-cutting
- Linkar cada ADR do `README.md` de índice e do `CLAUDE.md` do módulo correspondente (nova seção "## Decisões")
- Processo daqui pra frente: toda decisão arquitetural relevante de uma nova change gera um ADR em `docs/decisions/` (referenciado no `design.md` da change, mas sobrevivendo ao archive)

## Capabilities

### New Capabilities
- `decision-log`: Estrutura de ADRs versionada em `docs/decisions/`, com índice e processo de criação para decisões novas e passadas.

### Modified Capabilities
- Nenhuma — não há specs existentes em `openspec/specs/` para este domínio ainda.

## Impact

- Novo diretório `docs/decisions/` com subpastas por domínio + `README.md`
- `backend/internal/<domínio>/CLAUDE.md`: nova seção "## Decisões" linkando os ADRs do domínio
- `.claude/skills/openspec-propose` e `.claude/skills/openspec-apply-change` (fluxo de trabalho, não arquivos): orientação futura para criar ADR quando uma decisão de design relevante for tomada
- Nenhum impacto em código de produção (Go/Next.js) — puramente documentação/processo

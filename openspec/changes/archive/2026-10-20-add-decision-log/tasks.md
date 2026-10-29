## 1. Estrutura base

- [x] 1.1 Criar `docs/decisions/README.md` com template de índice (tabela: id | título | status | domínio | link)
- [x] 1.2 Criar `docs/decisions/_template.md` com seções Status/Context/Decision/Consequences

## 2. Backfill — identity

- [x] 2.1 Criar `docs/decisions/identity/0001-jwt-rs256.md` (por que RS256 em vez de HS256)
- [x] 2.2 Criar `docs/decisions/identity/0002-refresh-token-hash-2fa-temp-token.md` (hash SHA-256 de refresh token + fluxo temp_token do 2FA)
- [x] 2.3 Linkar os dois ADRs em `backend/internal/identity/CLAUDE.md` (seção "## Decisões")

## 3. Backfill — rbac

- [x] 3.1 Criar `docs/decisions/rbac/0001-hierarquia-roles-property-scoped.md` (owner/admin/viewer, property_id nil = global)
- [x] 3.2 Criar `docs/decisions/rbac/0002-migracao-organization-id.md` (migração de domínios para organization_id — commit 5ff91c4)
- [x] 3.3 Linkar os dois ADRs em `backend/internal/rbac/CLAUDE.md`

## 4. Backfill — property

- [x] 4.1 Criar `docs/decisions/property/0001-single-auto-cria-unit.md`
- [x] 4.2 Linkar em `backend/internal/property/CLAUDE.md`

## 5. Backfill — payment

- [x] 5.1 Criar `docs/decisions/payment/0001-payment-imutavel-sem-delete.md`
- [x] 5.2 Criar `docs/decisions/payment/0002-abstracao-multi-provider.md` (interface PaymentProvider)
- [x] 5.3 Linkar os dois ADRs em `backend/internal/payment/CLAUDE.md`

## 6. Backfill — audit

- [x] 6.1 Criar `docs/decisions/audit/0001-logs-imutaveis-sem-soft-delete.md`
- [x] 6.2 Linkar em `backend/internal/audit/CLAUDE.md`

## 7. Backfill — notification

- [x] 7.1 Criar `docs/decisions/notification/0001-separacao-listpending-listbyowner.md`
- [x] 7.2 Linkar em `backend/internal/notification/CLAUDE.md`

## 8. Backfill — cross-cutting

- [x] 8.1 Criar `docs/decisions/_cross-cutting/0001-soft-delete-obrigatorio.md`
- [x] 8.2 Linkar em `.claude/rules/domain-model.md`

## 9. Processo daqui pra frente

- [x] 9.1 Atualizar `.claude/skills/openspec-propose/SKILL.md` pra sugerir criação de ADR quando `design.md` tiver decisão arquitetural relevante
- [x] 9.2 Atualizar índice `docs/decisions/README.md` com todas as entradas criadas nas seções 2–8

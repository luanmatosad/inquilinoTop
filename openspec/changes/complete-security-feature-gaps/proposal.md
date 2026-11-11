# Proposal

## Why

A auditoria de código de 2026-11-11 mostrou que `2026-04-23-security-and-feature-enhancements` foi arquivado com itens abertos: 8 não implementados e 12 parciais. Os checkboxes desse change foram corrigidos ao estado real. Este change cobre o que falta, para que nada fique sem dono.

## What Changes

- Reajuste de aluguel por índice: endpoint de índices IPCA/IGP-M, aviso 30 dias antes do reajuste, scheduler anual. Depende de decisão de fonte do índice (ver design).
- Notificações: templates de e-mail (lembrete de cobrança, contrato vencendo), política de retry e cron de agendamento. Hoje o retry usa `MaxRetries = 5`, não 3.
- Auditoria: logging de mutações (create/update/delete), além de login/logout já existente.
- Versionamento de API: grupo `/api/v2/`, header de versão nas respostas, documentação de breaking changes.
- Itens parciais de segurança e autorização: handlers existentes com autorização por role, endpoint `/api/v1/auth/2fa/enable`, upload de documentos com validação (PDF, máximo 10MB), teste de CORS com diferentes origens.
- Testes pendentes do change original: testes de integração de endpoints, E2E de 2FA, stress de rate limiting.
- **BREAKING**: nenhum previsto. Retry e templates não mudam contrato público; v2 coexiste com v1.

## Capabilities

### New Capabilities

- `rent-index-adjustment`: reajuste de aluguel por índice (IPCA/IGP-M) com aviso prévio e confirmação manual.
- `notification-email-templates`: templates de e-mail de cobrança e contrato, e política de retry de envio.
- `audit-mutation-logging`: registro de mutações de dados em `audit_logs`.
- `api-versioning`: coexistência de `/api/v1/` e `/api/v2/` e header de versão nas respostas.

### Modified Capabilities

Nenhuma. Os itens parciais de autorização, 2FA, documentos e CORS são implementação de requisitos já existentes e entram em tasks.md sem delta spec.

## Impact

- Backend: `internal/lease` (índices, reajuste), `internal/notification` (templates, retry, cron), `internal/audit` (mutações), `internal/identity` (2FA enable), `internal/document` (validação de upload), `internal/rbac` (handlers), `cmd/api/main.go` (rotas v2, header de versão, scheduler).
- Migrations: tabela `index_values` já existe; novas só se a decisão de índice exigir.
- Dependência externa: fonte de índices (IBGE SIDRA e/ou FGV). Nova dependência externa; ver design.
- Frontend: nenhum requisito previsto neste change.

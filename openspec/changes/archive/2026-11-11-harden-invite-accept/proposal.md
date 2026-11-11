# Proposal

## Why

Convite é caminho de concessão de acesso à organização. Hoje qualquer usuário autenticado com org pode criar convite (nenhuma checagem de papel nas rotas `/organizations/me/*`), o convite aceita `role=owner`, o token fica em texto puro no banco, e `AcceptInvite` não confere o e-mail do convidado, não usa transação e não emite JWT com a org. Lançar a tela de convite antes disso expõe acesso a terceiros e quebra o aceite.

## What Changes

- **BREAKING** Rotas `/api/v1/organizations/me/*` (membros, convites, branches, `PATCH /organizations/me`) passam a exigir permissão RBAC (`member:invite`, `member:manage`, `branch:manage`, `org:update`, `org:read`). Hoje só exigem JWT.
- **BREAKING** `POST /organizations/me/invites` rejeita `role=owner` (400). Owner não é concedido por convite.
- Convite: token passa a ser guardado como SHA-256 (como `refresh_tokens`); o token bruto é devolvido uma única vez na criação (201).
- `POST /invites/accept` exige que o e-mail do usuário autenticado seja igual ao e-mail do convite (case-insensitive). Divergência responde 404 `INVITE_NOT_FOUND` (não revela o convite).
- Aceite em transação: criar membership e marcar convite como aceito juntos, com `UPDATE ... WHERE accepted_at IS NULL` condicional. Dois aceites concorrentes: um vence, o outro 409 `INVITE_ALREADY_USED`.
- Aceite recusa usuário que já tem membership em outra org (409 `ALREADY_HAS_ORG`), mesma regra de criação de org.
- Erros do aceite viram códigos específicos: `INVITE_NOT_FOUND` 404, `INVITE_EXPIRED` 400, `INVITE_ALREADY_USED` 409, `ALREADY_HAS_ORG` 409; falha de banco 500 (hoje tudo é 400).
- Após aceitar, o cliente chama `POST /api/v1/auth/refresh` para receber JWT com a org (já existe: `issueTokens` usa `orgRepo.GetByUserID`).
- Migration `000058`: converte tokens de convite pendentes para `sha256(token)`; links já enviados continuam válidos.

## Capabilities

### New Capabilities

- `organization-invites`: criação, entrega do token, aceite e regras de papel de convite.
- `organization-route-permissions`: permissão RBAC exigida por rota da organização.

### Modified Capabilities

Nenhuma capability principal em `openspec/specs/` cobre organização. A change `harden-org-access-controls` (ainda não arquivada) cobre `organization-membership`; este change não altera essas specs.

## Impact

- Backend: `internal/organization` (handler, service, repository, model), `cmd/api/main.go` (montagem das rotas com `rbac.PermissionMiddleware`), `internal/identity` (só consumo do refresh existente), nova migration `000058`.
- Frontend: tela de convite (Figma "Convite · 1–3") consome `POST /invites/accept` e `POST /auth/refresh`; códigos de erro novos precisam de mensagem.
- Não entra: fluxo "2 cadastro" (criar conta via convite). Decisão em design.md.
- Não entra: envio de e-mail do convite (canal de entrega em design.md).

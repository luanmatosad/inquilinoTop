# organization

Multi-tenancy: organização, filiais (branches), membros e convites. Escopo por `organization_id` (extraído do ctx via `auth.OrganizationIDFromCtx`), não por `owner_id`.

## Endpoints (`/api/v1`, todos com authMW)

| Método | Rota | Obs |
|---|---|---|
| GET/PATCH | `/organizations/me` | Org do usuário / atualiza `name` |
| GET/POST | `/organizations/me/branches` | |
| GET/PATCH/DELETE | `/organizations/me/branches/{id}` | PATCH aceita `is_active` |
| GET | `/organizations/me/members` | Inclui `user_email`, `user_full_name`, `branch_name` |
| PATCH | `/organizations/me/members/{id}/role` | |
| DELETE | `/organizations/me/members/{id}` | |
| GET/POST | `/organizations/me/invites` | POST enfileira e-mail com o link de aceite |
| DELETE | `/organizations/me/invites/{id}` | Cancela convite |
| POST | `/invites/accept` | Aceita por token |

## Modelo

- `RoleType`: `owner`, `admin`, `manager`, `employee`, `viewer`.
- Convites aceitam só `admin`, `manager`, `employee`, `viewer` (CHECK em `organization_invites`, migration 000061). `owner` nunca é convidado.
- `Member` = user + org + role + `branch_id` opcional.
- `Invite.Token` é `json:"-"` (nunca serializado); tem `expires_at`/`accepted_at`.
- `Repository` tem ~20 métodos (Org, Branch, Member, Invite) — candidato a split por ISP.

## Gotchas

- Service tem dois helpers: `getOrgID` (org do ctx) e `getOwnerID` (user do ctx); `GetMyOrganization` resolve a org via `GetByUserID`, as demais via ctx.
- `CreateInvite` busca a org antes de gravar e, após gravar, chama `InviteNotifier.NotifyInvite` com `<APP_PUBLIC_URL>/invite/accept?token=<token bruto>` (`APP_PUBLIC_URL` default `http://localhost:3000`). Falha ao enfileirar só loga (`slog.Error`): o convite continua válido e não há reenvio. Quem envia é o worker de notificações.
- `GetMembershipByID` não filtra por org no service.
- Relaciona-se com [rbac](../rbac/CLAUDE.md) (permissões por role). Ver ADR rbac-0002.

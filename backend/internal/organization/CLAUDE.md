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
| GET/POST | `/organizations/me/invites` | |
| DELETE | `/organizations/me/invites/{id}` | Cancela convite |
| POST | `/invites/accept` | Aceita por token |

## Modelo

- `RoleType`: `owner`, `admin`, `manager`, `employee`, `viewer`.
- `Member` = user + org + role + `branch_id` opcional.
- `Invite.Token` é `json:"-"` (nunca serializado); tem `expires_at`/`accepted_at`.
- `Repository` tem ~20 métodos (Org, Branch, Member, Invite) — candidato a split por ISP.

## Gotchas

- Service tem dois helpers: `getOrgID` (org do ctx) e `getOwnerID` (user do ctx); `GetMyOrganization` resolve a org via `GetByUserID`, as demais via ctx.
- `GetMembershipByID` não filtra por org no service.
- Relaciona-se com [rbac](../rbac/CLAUDE.md) (permissões por role). Ver ADR rbac-0002.

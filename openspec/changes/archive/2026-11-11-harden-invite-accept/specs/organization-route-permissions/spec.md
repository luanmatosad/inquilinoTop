# Spec Delta

## Purpose

Define a permissão RBAC exigida em cada rota de gestão da organização. Hoje essas rotas exigem apenas JWT válido, então qualquer membro, inclusive `viewer`, consegue alterar membros, convidar e mudar dados da organização.

## ADDED Requirements

### Requirement: Rotas de gestão exigem permissão RBAC

O sistema MUST exigir a permissão RBAC abaixo em cada rota sob `/api/v1/organizations/me`, verificada contra `organization_members` no banco a cada requisição.

| Rota | Permissão |
|------|-----------|
| `GET /organizations/me` | `org:read` |
| `PATCH /organizations/me` | `org:update` |
| `GET /organizations/me/members` | `org:read` |
| `PATCH /organizations/me/members/{id}/role` | `member:manage` |
| `DELETE /organizations/me/members/{id}` | `member:manage` |
| `GET /organizations/me/invites` | `member:invite` |
| `POST /organizations/me/invites` | `member:invite` |
| `DELETE /organizations/me/invites/{id}` | `member:invite` |
| rotas de branches (escrita) | `branch:manage` |

#### Scenario: viewer tenta convidar
- **WHEN** um membro com papel `viewer` chama `POST /organizations/me/invites`
- **THEN** a resposta é 403 com código `FORBIDDEN` e nenhum convite é criado

#### Scenario: viewer lê membros
- **WHEN** um membro com papel `viewer` chama `GET /organizations/me/members`
- **THEN** a resposta é 200 se `viewer` tem `org:read`, e 403 caso contrário

#### Scenario: usuário sem organização
- **WHEN** o JWT não tem organização
- **THEN** a resposta é 401 com código `NO_ORG`

#### Scenario: papel alterado no banco
- **WHEN** o papel do membro foi alterado no banco e ele ainda envia JWT antigo
- **THEN** a permissão é avaliada pelo papel atual no banco, não pelo claim do JWT

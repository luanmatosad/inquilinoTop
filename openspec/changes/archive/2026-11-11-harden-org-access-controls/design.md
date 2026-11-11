# Design

## Context

- `organization/service.go:70-77`: `CreateOrganization` faz `GetByUserID` e, se nulo, chama `repo.CreateWithOwner`. `CreateWithOwner` (`repository.go:72-98`) abre tx só para os INSERTs; o check fica fora dela.
- `migrations/000031_create_organizations.up.sql:35`: `organization_members` tem `UNIQUE (organization_id, user_id)`, mas nada impede dois owners para o mesmo usuário em orgs diferentes.
- `notification/repository.go` `ListPending`: sem filtro de org, pensado para o worker (`notification/CLAUDE.md`). `cmd/api/main.go:279` inicia o worker a cada minuto.
- `rbac/middleware.go:11-42`: `PermissionMiddleware` é função sobre o contexto; role vem de `auth.RoleFromCtx`. Passa a precisar de acesso à membership.
- `branch_id` é nullable (`000031:32`): não entra no fix.

## Goals / Non-Goals

**Goals:**
- Um owner por usuário, garantido pelo banco.
- Nenhum endpoint HTTP dispara envio de notificações.
- Papel revogado vale na próxima requisição protegida.

**Non-Goals:**
- Aceite de convite e renovação de token após aceite (change própria, quando houver tela).
- Escalonamento do worker para múltiplas réplicas (`FOR UPDATE SKIP LOCKED`): com mais de uma réplica já pode duplicar envio hoje; registrado como risco.
- Mudança no modelo de roles.

## Decisions

**D1. Remover `POST /api/v1/notifications/process` e `processQueue`.**
Alternativa: restringir a owner ou filtrar por org. Descartada: o worker já cobre o caso, e filtrar por org exigiria mudar `ListPending`, que o worker usa globalmente. Clean cutover: sem alias, sem 410.

**D2. Índice único parcial + mapeamento de erro.**
`CREATE UNIQUE INDEX ... ON organization_members(user_id) WHERE role = 'owner'`. `CreateWithOwner` mapeia erro `23505` (unique_violation) para `ErrAlreadyHasOrganization`; a tx faz rollback da organização nesse caso.
Alternativa: `pg_advisory_xact_lock(hashtext(user_id))` antes do check. Descartada como mecanismo principal: mais código e depende de disciplina em todo caminho de escrita. Mantém-se o `GetByUserID` como caminho rápido para o 409 comum.
Pré-requisito da migration: `SELECT user_id FROM organization_members WHERE role='owner' GROUP BY user_id HAVING COUNT(*) > 1`. Se retornar linhas, a migration falha de propósito e a correção é manual.

**D3. Revalidação de papel consultando o banco (decidido: opção a).**
`PermissionMiddleware` consulta `organization_members` por `(user_id, organization_id)` e usa o role do banco em vez do JWT. Sem membership → 403 `FORBIDDEN`. O repositório entra por injeção de dependência no middleware, sem estado global.
Alternativa descartada: TTL curto do access token + refresh após mudança de role. Revogação em até o TTL, e exige ajuste no fluxo de refresh.

## Risks / Trade-offs

- **Migration falha com duplicatas existentes** → verificação de pré-requisito antes; correção manual.
- **Uma query extra por requisição protegida** (D3) → custo baixo com índice em `user_id`; medir se houver regressão de latência.
- **Corrida no worker com mais de uma réplica** → fora de escopo; risco documentado.
- **Índice cobre só owner** → membros não-owner continuam bloqueados na criação pelo `GetByUserID`; sem mudança de comportamento.

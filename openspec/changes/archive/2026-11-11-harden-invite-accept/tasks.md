# Tasks

## 1. Permissão nas rotas da organização

- [x] 1.1 Trocar `RegisterRoutes(r, authMW)` por versão que recebe middlewares de `rbac.PermissionMiddleware` e aplicá-los por rota conforme a tabela da spec `organization-route-permissions` (`main.go:260`). Verificar: `go build` do backend passa.
- [x] 1.2 Teste de integração: membro `viewer` recebe 403 `FORBIDDEN` em `POST /organizations/me/invites` e `DELETE /organizations/me/members/{id}`. Verificar: `make test-backend-integration` com o novo teste verde.
- [x] 1.3 Teste de integração: owner continua recebendo 200 nas mesmas rotas. Verificar: mesmo comando.

## 2. Papel de convite

- [x] 2.1 Remover `owner` de `CreateInviteInput.Role` (`model.go:87–90`, `oneof=admin manager employee viewer`). Verificar: teste de handler com `role=owner` retorna 400 `INVALID_ROLE`, com `make test-backend`.
- [x] 2.2 Teste de handler: `role=admin` continua aceito (201). Verificar: `make test-backend`.

## 3. Token de convite com hash

- [x] 3.1 Migration `000058_hash_invite_tokens.{up,down}.sql`: `up` troca token pendente por `encode(sha256(convert_to(token,'UTF8')),'hex')`; `down` não restaura, documentado no próprio arquivo. Verificar: contar pendentes antes com `SELECT count(*)`, aplicar em dev e teste, e conferir que o hash bate com o bruto de um convite criado antes.
- [x] 3.2 `CreateInvite` gera token bruto, grava o hash e devolve o bruto na resposta 201 (campo específico na resposta, não no model persistido). Verificar: teste de service com mockRepo confirma que o valor gravado não é o bruto.
- [x] 3.3 `GetInviteByToken` busca por hash do token recebido. Verificar: teste de service com token bruto encontra o convite; token errado retorna `ErrInviteNotFound`.
- [x] 3.4 Listagem de convites continua sem token. Verificar: `TestHandler_ListInvites_NaoExpoeToken` confirma que `GET /organizations/me/invites` não contém o token nem o campo `"token"`.

## 4. Aceite seguro

- [x] 4.1 Repositório busca e-mail do usuário autenticado por id (consulta em `users`). Verificar: teste de repositório com usuário existente e inexistente.
- [x] 4.2 Service compara e-mail do convite com o do usuário (`strings.EqualFold`); divergência retorna `ErrInviteNotFound`. Verificar: teste de service para e-mail diferente (404) e para e-mail com caixa diferente (aceita).
- [x] 4.3 Repositório aceita em transação: `UPDATE ... WHERE accepted_at IS NULL AND expires_at > NOW()` e `INSERT` em `organization_members` no mesmo `tx`; 0 linhas no UPDATE vira erro sentinela. Verificar: teste de integração com duas goroutines aceitando o mesmo convite: exatamente uma membership, outra 409 `INVITE_ALREADY_USED`.
- [x] 4.4 Falha no `INSERT` faz rollback e deixa convite pendente. Verificar: teste de integração com membership já existente para o usuário na mesma org confirma convite ainda pendente. Desvio: a checagem de membership roda antes do `INSERT`, então o teste cobre convite pendente após recusa, não o rollback do INSERT em si.
- [x] 4.5 Aceite recusa usuário com membership em outra org (`ALREADY_HAS_ORG`, 409). Verificar: teste de integração (decisão D6 pendente de confirmação).
- [x] 4.6 Handler mapeia erros sentinela para 404 `INVITE_NOT_FOUND`, 400 `INVITE_EXPIRED`, 409 `INVITE_ALREADY_USED`, 409 `ALREADY_HAS_ORG`, 500 para o resto, sem vazar mensagem de banco. Verificar: `TestHandler_AcceptInvite_CodigosDeErro` cobre cada código e o vazamento do 500. Extras: 409 `INVITE_BRANCH_GONE` (não previsto na spec).

## 5. Renovação do token após aceite

- [x] 5.1 Teste de integração: após aceite, `POST /auth/refresh` devolve JWT com `organization_id` e papel do convite. Verificar: `TestRefresh_AposAceiteDevolveOrgEPapelDoConvite` (identity, integração) passa.

## 6. Documentação e verificação final

- [x] 6.1 Atualizar `backend/CHANGELOG.md` com novos códigos de erro, migration 000058 e contagem de convites pendentes antes da migration. Verificar: entrada presente.
- [x] 6.2 Regenerar swagger. Desvio: nada a regenerar. Rotas de organização nunca tiveram anotação swag (checado em HEAD e árvore; `backend/docs/swagger.json` não tem path `organizations`) e `swag` não está instalado no container. `backend/docs/` sem mudança.
- [x] 6.3 `make test-backend` e `make test-backend-integration` verdes. Verificar: exit 0 nos dois (unit e integração, ambos exit 0).
- [x] 6.4 `graphify update .` após editar código. Verificar: exit 0.

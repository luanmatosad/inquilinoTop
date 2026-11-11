# Design

## Context

Convite está em `backend/internal/organization/`. Rotas em `handler.go` (L24–47), montadas em `cmd/api/main.go:260` com `orgHandler.RegisterRoutes(r, authMW)`, sem `rbac`. `CreateInvite` (`service.go:203`) não verifica papel. `HasRole` do service existe mas nenhum handler chama. `AcceptInvite` (`service.go:240`) faz `GetInviteByToken`, checa `AcceptedAt`/expiração, depois `CreateMember` e `repo.AcceptInvite` em chamadas separadas, sem transação. `Invite.Token` tem `json:"-"` e não é selecionado nas consultas, então a resposta de criação nunca devolve o token: hoje não há como o convidado receber o link. JWT é emitido com org por `identity.issueTokens` (`identity/service.go:177`) via `orgRepo.GetByUserID`; `Refresh` reemite por esse mesmo caminho. Refresh tokens já são guardados como SHA-256 (`tokenHash`). Permissões: `rbac/model.go:33–37` (`member:invite`, `member:manage`, `branch:manage`, `org:read`, `org:update`). Ver proposal.md para o motivo.

## Goals / Non-Goals

**Goals:**
- Nenhum papel elevado por convite; nenhuma rota de gestão aberta a qualquer membro.
- Token de convite inútil se o banco vazar.
- Aceite só pelo e-mail convidado, uma vez, atômico.

**Non-Goals:**
- Envio automático de e-mail do convite.
- Criação de conta dentro do aceite (fluxo "2 cadastro" do Figma).
- Novo endpoint de refresh ou de troca de org.
- Mudança na matriz de papéis de `rbac/model.go`.

## Decisions

**D1. Permissão por rota, via `rbac.PermissionMiddleware`.** Mesmo middleware de `property`/`tenant`/`lease`, que consulta `organization_members` por requisição (decisão já tomada em `harden-org-access-controls`). Alternativa rejeitada: checar papel dentro do service; ficaria fora do padrão e seria fácil esquecer em uma rota.

**D2. `owner` removido do conjunto de papéis de convite.** Validação `oneof=admin manager employee viewer` em `CreateInviteInput` (`model.go:87–90`). Motivo: o índice `uq_org_members_one_owner_per_user` (migration 000057) faria o aceite falhar com 500 se o convidado já fosse owner de outra org, e owner nunca deve ser concedido por convite. Owner continua sendo só o criador da org.

**D3. Token: hash SHA-256 no banco, bruto devolvido uma vez.** Mesmo padrão de `refresh_tokens.token_hash`. O bruto é devolvido no 201 de `POST /organizations/me/invites`; o dono da org o compartilha. Alternativa rejeitada: enviar e-mail direto (exige serviço de e-mail que o repo não tem para convites). Migration `000058`: `UPDATE organization_invites SET token = encode(sha256(convert_to(token, 'UTF8')), 'hex') WHERE accepted_at IS NULL`. Links já gerados continuam válidos, porque o token bruto é o mesmo e o hash bate. Lookup passa a ser `WHERE token = sha256(bruto)`.

**D4. Aceite com e-mail do usuário.** O service recebe `userID` (já recebe) e busca o e-mail em `users` pelo repositório da organização (consulta simples por id). Comparação `strings.EqualFold`. Alternativa rejeitada: colocar e-mail no JWT; aumenta claims e fica desatualizado se o e-mail mudar.

**D5. Transação e marcação condicional.** Repositório abre transação: `UPDATE organization_invites SET accepted_at = NOW() WHERE id = $1 AND accepted_at IS NULL AND expires_at > NOW()` (0 linhas → `ErrInviteAlreadyUsed` ou `ErrInviteExpired` conforme releitura) e `INSERT` em `organization_members` no mesmo `tx`. Commit só se os dois passos funcionarem. Isso elimina a corrida: a segunda transação não consegue marcar o convite. Alternativa rejeitada: `SELECT ... FOR UPDATE`; funciona, mas a marcação condicional já é atômica e não segura lock durante o insert.

**D6. Um usuário, uma org, também no aceite.** Aceite recusa com 409 `ALREADY_HAS_ORG` se o usuário já tem membership em outra org. Motivo: `GetByUserID` escolhe uma membership para o JWT, então várias orgs deixariam o token ambíguo. Mesma regra que `CreateWithOwner` já aplica a owners. **Decisão a confirmar na revisão** (ver Open Questions).

**D7. Mapeamento de erro.** Erros sentinela em `organization`: `ErrInviteNotFound`, `ErrInviteExpired`, `ErrInviteAlreadyUsed`, `ErrAlreadyHasOrganization` (já existe), `ErrInvalidRole`. Handler mapeia para 404/400/409/409/400. Qualquer outro erro vira 500 (`INTERNAL`). Mensagem vinda de erro de banco nunca vai para o cliente.

**D8. Refresh após aceite.** O cliente chama `POST /auth/refresh`. `issueTokens` já encontra a membership nova. Sem endpoint novo.

## Risks / Trade-offs

- **[Token devolvido uma vez se perder a resposta]** → O dono cancela o convite (`DELETE`) e cria outro. Aceito; é o custo do hash.
- **[Migration de hash altera linhas em produção]** → O `UPDATE` não é reversível: o `.down` não restaura tokens brutos, só deixa de existir. Mitigação: registrar `SELECT count(*)` de convites pendentes no CHANGELOG antes de aplicar, e não rodar `.down` com convites pendentes (eles deixariam de aceitar).
- **[Rota de membros fica mais restrita]** → Papel `employee`/`viewer` deixa de gerir membros; é a intenção, mas quebra qualquer tela que hoje depende disso. Mitigação: checar `frontend/src/lib/go/` antes de aplicar.
- **[`ALREADY_HAS_ORG` impede aceitar convite após sair de outra org]** → Usuário precisa sair da org atual antes. Aceito por enquanto.
- **[Corrida entre `UPDATE` do convite e `DELETE` de membership]** → Coberto pela transação; sem risco adicional conhecido.

## Migration Plan

1. Aplicar `000058` (hash dos pendentes) em dev e teste; verificar que o link de um convite pendente criado antes ainda aceita.
2. Deploy do backend com rbac nas rotas de organização e validação de papel.
3. Frontend: tela de convite passa a mostrar o token devolvido e tratar os códigos novos. Lançar convite a usuários reais só depois disso.
4. Rollback: reverter o código; a migration `down` não restaura os tokens brutos (ver Risks). Por isso o passo 1 vem com contagem registrada antes.

## Open Questions

- **Canal de entrega do token**: o dono copia o link e envia (WhatsApp/e-mail manual) ou o sistema envia e-mail? Default deste design: copiar o link devolvido na criação. Confirmar antes de implementar a tela.
- **Tela "2 cadastro"**: entra nesta change (criar conta no aceite) ou só quem já tem conta? Default: só quem já tem conta; cadastro via convite fica para change própria.
- **D6 (uma org por usuário no aceite)**: confirmar.

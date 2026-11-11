## ADDED Requirements

### Requirement: Papel revalidado contra a membership em rotas sensíveis
Rotas protegidas por permissão de organização SHALL verificar o papel atual do usuário na tabela de membership, e não apenas o papel contido no token.

#### Scenario: Owner rebaixado perde acesso imediatamente
- **WHEN** o token do usuário ainda declara papel `owner`, mas a membership foi alterada para `viewer`
- **THEN** a rota sensível responde 403 com código `FORBIDDEN`

#### Scenario: Membro removido perde acesso
- **WHEN** o usuário foi removido da organização e envia requisição com token ainda válido
- **THEN** a resposta é 403 com código `NO_ROLE` ou `FORBIDDEN`, sem dados da organização

#### Scenario: Membership vigente mantém acesso
- **WHEN** a membership do usuário corresponde ao papel exigido pela rota
- **THEN** a requisição segue normalmente

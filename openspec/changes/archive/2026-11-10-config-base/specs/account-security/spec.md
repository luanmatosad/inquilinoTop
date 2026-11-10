## ADDED Requirements

### Requirement: Setup do 2FA só para o usuário logado
`POST /auth/2fa/setup` SHALL operar apenas sobre o usuário autenticado (nunca sobre um e-mail informado), gerar um segredo **pendente** sem ativar o 2FA e devolver o segredo e a URL do QR. Com o 2FA já ativo SHALL responder 409 `ALREADY_ENABLED` sem alterar nada.

#### Scenario: Corpo com e-mail de outra pessoa
- **WHEN** um usuário logado envia o e-mail de outro usuário no corpo do setup
- **THEN** o setup vale para o próprio usuário e o outro não é alterado

#### Scenario: Setup abandonado
- **WHEN** o usuário inicia o setup e não confirma o código
- **THEN** o 2FA continua desativado e o login segue só com a senha

#### Scenario: Já ativo
- **WHEN** o usuário com 2FA ativo chama o setup
- **THEN** a resposta é 409 `ALREADY_ENABLED` e o segredo atual é mantido

### Requirement: Código TOTP inválido nunca autentica
A verificação do código TOTP (ao ativar e no login com 2FA) SHALL aceitar somente códigos que a biblioteca valida para o segredo da conta; qualquer outro código SHALL ser recusado.

#### Scenario: Login com código errado
- **WHEN** uma conta com 2FA ativo informa a senha certa e o código `000000` (errado)
- **THEN** o login com 2FA é recusado e nenhum token é emitido

### Requirement: Confirmar e ativar o 2FA
`POST /auth/2fa/verify` SHALL ativar o 2FA só com um código TOTP válido do segredo pendente e SHALL devolver os códigos de recuperação uma única vez. Código inválido SHALL dar 400 `INVALID_CODE` e manter desativado; sem setup prévio, 409 `NOT_CONFIGURED`.

#### Scenario: Código correto
- **WHEN** o usuário confirma o código do app autenticador
- **THEN** o 2FA fica ativo e a resposta traz os 10 códigos de recuperação de 10 dígitos

#### Scenario: Código errado
- **WHEN** o código informado é inválido
- **THEN** a resposta é 400 `INVALID_CODE` e o 2FA continua desativado

### Requirement: Trocar a senha
`POST /auth/password` SHALL trocar a senha do usuário autenticado depois de conferir a senha atual, aplicando a mesma regra de tamanho do cadastro e recusando a senha igual à atual. Senha atual errada SHALL dar 400 `INVALID_PASSWORD`; nova senha fraca, 400 `WEAK_PASSWORD`.

#### Scenario: Senha atual errada
- **WHEN** o usuário informa a senha atual incorreta
- **THEN** a resposta é 400 `INVALID_PASSWORD` e a senha não muda

#### Scenario: Troca válida
- **WHEN** o usuário informa a atual correta e uma nova válida
- **THEN** o próximo login exige a nova senha

### Requirement: Tela de Segurança
O frontend SHALL oferecer `/settings/security` com a troca de senha e a verificação em duas etapas: ativar (QR e segredo, código de 6 dígitos, códigos de recuperação exibidos uma vez) e desativar (com a senha); o estado vem de `two_factor_enabled` do perfil.

#### Scenario: Ativar o 2FA
- **WHEN** o usuário ativa, escaneia o QR e confirma o código
- **THEN** a tela mostra os códigos de recuperação uma vez e o estado "Ligada"

#### Scenario: Desativar
- **WHEN** o usuário desativa informando a senha
- **THEN** o estado volta a "Desligada"

## ADDED Requirements

### Requirement: Split-screen layout
A tela `/login` SHALL exibir um layout dividido em duas colunas em viewports `md` (≥768px) ou maiores: formulário de autenticação à esquerda, painel de marca (imagem + headline) à direita. Em viewports menores que `md`, SHALL exibir apenas o formulário de autenticação, ocupando a largura total.

#### Scenario: Desktop exibe as duas colunas
- **WHEN** um usuário acessa `/login` em viewport ≥768px
- **THEN** o painel de marca (imagem + headline "Menos planilhas. Mais controle.") é exibido ao lado do formulário

#### Scenario: Mobile oculta o painel de marca
- **WHEN** um usuário acessa `/login` em viewport <768px
- **THEN** apenas o formulário de autenticação é exibido, sem o painel de marca

### Requirement: Login social Google (UI)
O formulário de login SHALL exibir um botão "Entrar com a conta Google" acima do divisor "Ou" e dos campos de e-mail/senha. Enquanto o backend não suportar OAuth Google, o botão SHALL ficar desabilitado (`disabled`).

#### Scenario: Botão Google visível e desabilitado
- **WHEN** um usuário acessa `/login`
- **THEN** o botão "Entrar com a conta Google" é exibido com estado desabilitado e não dispara nenhuma ação ao ser clicado

### Requirement: Autenticação por e-mail e senha
O formulário SHALL manter os campos "E-mail" e "Senha" com validação obrigatória, submetendo via a mesma Server Action (`login`) já integrada à Go API, preservando o comportamento de erro/sucesso existente.

#### Scenario: Login com credenciais válidas
- **WHEN** um usuário preenche e-mail e senha válidos e submete o formulário
- **THEN** a Server Action `login` é chamada e, em caso de sucesso, o usuário é redirecionado conforme o comportamento atual

#### Scenario: Login com credenciais inválidas
- **WHEN** um usuário submete e-mail ou senha inválidos
- **THEN** a mensagem de erro retornada pela Server Action é exibida no formulário

### Requirement: Alternância para cadastro
O formulário SHALL exibir um botão secundário (estilo outline) "Não possui conta? Cadastra-se" abaixo do botão de login, que leva o usuário ao modo de cadastro na mesma rota (`/login?mode=signup`), sem exibir tabs.

#### Scenario: Usuário alterna para cadastro
- **WHEN** um usuário clica em "Não possui conta? Cadastra-se" na tela de login
- **THEN** a URL muda para `/login?mode=signup` e o formulário passa a exibir os campos de cadastro (incluindo nome completo), mantendo o painel de marca

### Requirement: Visibilidade de senha
O campo de senha SHALL incluir um ícone de alternância (mostrar/ocultar) dentro do próprio campo, preservando o comportamento já existente na implementação atual.

#### Scenario: Alternar visibilidade da senha
- **WHEN** um usuário clica no ícone de olho dentro do campo de senha
- **THEN** o texto da senha alterna entre oculto (`type="password"`) e visível (`type="text"`)

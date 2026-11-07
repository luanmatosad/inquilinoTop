## ADDED Requirements

### Requirement: Tokens de cor do canvas
O frontend SHALL definir em `globals.css` os tokens de cor do design system do canvas (`tokens.json`) para o tema claro e para o tema escuro, incluindo `success` e `warning`.

#### Scenario: Tema claro
- **WHEN** a página renderiza sem a classe `dark`
- **THEN** `--background` é `#ffffff`, `--primary` é `#4f46e5` e `--accent` é `#e0e7ff`

#### Scenario: Tema escuro
- **WHEN** a página renderiza com a classe `dark` no `<html>`
- **THEN** `--background` é `#18181b`, `--primary` é `#4f46e5` e `--secondary` é `#1e1f3a`

#### Scenario: Cores de estado
- **WHEN** um componente usa `bg-success` ou `bg-warning`
- **THEN** a cor resolve para o token do tema ativo

### Requirement: Tipografia do canvas
O frontend SHALL usar Urbanist como fonte sans e Space Mono como fonte mono, ambas self-hosted.

#### Scenario: Texto padrão
- **WHEN** a página renderiza texto sem classe de fonte
- **THEN** a família computada começa por Urbanist

#### Scenario: Container sem internet
- **WHEN** o dev server roda em ambiente sem acesso à internet
- **THEN** as fontes carregam sem requisição externa e o build não falha

### Requirement: Alternância de tema
O frontend SHALL permitir ao usuário alternar entre tema claro e escuro e SHALL lembrar a escolha.

#### Scenario: Troca para escuro
- **WHEN** o usuário aciona o toggle de tema estando no claro
- **THEN** o `<html>` recebe a classe `dark` e as cores do tema escuro se aplicam

#### Scenario: Escolha preservada
- **WHEN** o usuário recarrega a página depois de escolher o tema escuro
- **THEN** a página abre no tema escuro

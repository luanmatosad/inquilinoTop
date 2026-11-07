## MODIFIED Requirements

### Requirement: Tipografia do canvas
O frontend SHALL usar Urbanist como fonte sans e Space Mono como fonte mono, ambas self-hosted, aplicadas desde o elemento `<html>`.

#### Scenario: Texto padrão
- **WHEN** a página renderiza texto sem classe de fonte
- **THEN** a família computada começa por Urbanist

#### Scenario: Fonte no elemento raiz
- **WHEN** o layout raiz renderiza
- **THEN** as variáveis de fonte estão no `<html>` e o `<body>` usa `font-sans`, de modo que `html` e `body` tenham a mesma família computada

#### Scenario: Fonte mono
- **WHEN** um elemento usa `font-mono`
- **THEN** a família computada começa por Space Mono

#### Scenario: Container sem internet
- **WHEN** o dev server roda em ambiente sem acesso à internet
- **THEN** as fontes carregam sem requisição externa e o build não falha

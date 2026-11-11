# design-tokens Specification

## Purpose
Tokens visuais do canvas "ImoviFlow — Telas" (cores claro/escuro, tipografia, alternância de tema) aplicados em `globals.css`.
## Requirements
### Requirement: Tokens de cor do canvas
O frontend SHALL definir em `globals.css` os tokens de cor do design system do Figma (UI Kit ImoviFlow, node 5984:59776) para o tema claro e para o tema escuro, incluindo `success` e `warning`.

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

### Requirement: Alternância de tema
O frontend SHALL permitir ao usuário alternar entre tema claro e escuro e SHALL lembrar a escolha.

#### Scenario: Troca para escuro
- **WHEN** o usuário aciona o toggle de tema estando no claro
- **THEN** o `<html>` recebe a classe `dark` e as cores do tema escuro se aplicam

#### Scenario: Escolha preservada
- **WHEN** o usuário recarrega a página depois de escolher o tema escuro
- **THEN** a página abre no tema escuro

### Requirement: Figma é a fonte da verdade dos tokens
Os valores de cor semântica, tipografia, espaçamento, radius e sombra usados pelo frontend MUST corresponder aos valores do Figma (UI Kit ImoviFlow, node 5984:59776). Exceções: `--input` (requirement de borda de controle) e `--ring` no tema dark (requirement de foco do teclado).

#### Scenario: Cor semântica light igual ao Figma
- **WHEN** o tema light é aplicado
- **THEN** `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--border` e `--success` têm os valores hex do Figma

#### Scenario: Modo dark vem do Figma
- **WHEN** o tema dark é aplicado (`.dark` ou `[data-theme="dark"]`)
- **THEN** cada token semântico tem o valor do modo Dark exportado do Figma, exceto `--input` e `--ring`

### Requirement: Foco do teclado no dark
`--ring` no tema dark MUST ser `#818cf8`, com contraste mínimo de 3:1 (WCAG 2.4.7) sobre `#18181b`. O Figma dark tem `#4f46e5`, que dá 2.82:1 sobre `#18181b`; o desvio é aceito.

#### Scenario: Ring dark
- **WHEN** o tema dark é aplicado
- **THEN** `--ring` é `#818cf8` (5.94:1 sobre `#18181b`)

### Requirement: Tipografia de texto xs é 14px
O token `text-xs` MUST resolver para 14px.

#### Scenario: Texto xs
- **WHEN** um elemento usa a classe `text-xs`
- **THEN** o `font-size` computado é 14px

### Requirement: Tipografia e fonte
A família sans MUST ser Urbanist. A escala de tamanho MUST conter 14, 16, 20, 24, 30, 36, 48, 60, 72 e 128px (valores do Figma Typography; 12px descartado porque `text-xs` = 14px). Pesos MUST incluir 400, 500, 600 e 700.

#### Scenario: Família padrão
- **WHEN** um elemento usa `font-sans`
- **THEN** a família computada começa com Urbanist

### Requirement: Espaçamento em grid de 4px
Os tokens de espaçamento e gap MUST ser múltiplos de 4px, com exceção de `0.5`, `1.5`, `2.5` e `px` (1px), que são mantidos com nomes normalizados.

#### Scenario: Gap padrão
- **WHEN** um elemento usa `gap-4`
- **THEN** o gap computado é 16px

### Requirement: Escala de radius
A escala de radius MUST conter none (0), sm (2px), md (6px), lg (8px), xl (12px), 2xl (16px), 3xl (24px) e full (9999px). `--radius` MUST ser 8px.

#### Scenario: Radius lg
- **WHEN** um elemento usa `rounded-lg`
- **THEN** o border-radius computado é 8px

### Requirement: Sombras
Os tokens `shadow-xs` e `shadow-base` MUST produzir `box-shadow` equivalente às Effects do Figma (drop shadow com color, offset, radius).

#### Scenario: Sombra base
- **WHEN** um elemento usa `shadow-base`
- **THEN** o `box-shadow` computado contém as duas camadas do Figma (offset 0 1px, radius 2px com alpha 0.06 e radius 3px com alpha 0.10)

### Requirement: Opacidade em fração
Tokens de opacidade MUST ser expressos como fração (`0.5`), não como percentual.

#### Scenario: Opacidade 50
- **WHEN** um elemento usa `opacity-50`
- **THEN** o `opacity` computado é 0.5

### Requirement: Borda de controle de formulário
`--input` MUST ser `#8f8f96` nos modos light e dark, com contraste mínimo de 3:1 (WCAG 1.4.11) sobre `#ffffff`, `#fefefc` e o fundo dark. No modo dark, o Figma tem `#242427` (1.14:1 sobre `#18181b`); o desvio é aceito. O token `input` do Figma no modo light MUST ter o mesmo valor.

#### Scenario: Input com contraste suficiente
- **WHEN** um campo de formulário é renderizado no tema light sobre `#ffffff`
- **THEN** a borda usa `--input` = `#8f8f96`, com contraste medido de 3.21:1

#### Scenario: Figma e código iguais no light
- **WHEN** o token `input` do Figma no modo light é comparado a `--input` no `:root` de `globals.css`
- **THEN** ambos são `#8f8f96`

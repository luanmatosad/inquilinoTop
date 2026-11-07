# ui-primitives Specification

## Purpose
TBD - created by archiving change alinhamento-visual. Update Purpose after archive.
## Requirements
### Requirement: Campos de formulário com a altura do canvas
Os componentes `Input` e `Select` (gatilho) SHALL ter altura de 36px a partir do breakpoint `md` e de 44px abaixo dele, e `Input`, `Select` e `Textarea` SHALL ter raio de 6px, borda e `shadow-xs`; o `Textarea` mantém altura mínima própria por ser multilinha.

#### Scenario: Desktop
- **WHEN** um `Input` ou `Select` renderiza em tela larga
- **THEN** a altura é 36px

#### Scenario: Celular
- **WHEN** a largura é menor que 768px
- **THEN** a altura é 44px

#### Scenario: Sem classe avulsa
- **WHEN** uma tela usa `Input` ou `Select` sem classe de altura
- **THEN** o campo já tem a altura do canvas

### Requirement: Botão com a altura do canvas
O componente `Button` SHALL ter altura de 32px a partir de `md` e de 44px abaixo dele no tamanho padrão, raio de 6px e texto de 14px com peso 500.

#### Scenario: Tamanho padrão
- **WHEN** um `Button` sem `size` renderiza em tela larga
- **THEN** a altura é 32px

#### Scenario: Botão de rodapé fixo
- **WHEN** a tela de celular usa o botão principal na barra inferior
- **THEN** não precisa de classe de altura própria

### Requirement: Card com o espaçamento do canvas
O componente `Card` SHALL ter raio 12, borda e `shadow-sm`, e seu cabeçalho SHALL ter 16px de padding com 4px entre título e descrição; o título SHALL ter 16px/24px com peso 600.

#### Scenario: Card padrão
- **WHEN** um `Card` com `CardHeader` e `CardContent` renderiza
- **THEN** o cabeçalho e o conteúdo têm 16px de padding horizontal

#### Scenario: Card sem cabeçalho
- **WHEN** uma tela usa `Card` como contêiner de tabela
- **THEN** pode zerar o espaçamento com uma única prop (`size="flush"`) em vez de duas classes

### Requirement: Tabela com o espaçamento do canvas
O componente `Table` SHALL ter cabeçalho com texto de 12px, peso 500, cor `muted-foreground` e fundo `muted`, e células com 12px de padding vertical e 16px horizontal, com altura mínima de linha de 56px.

#### Scenario: Cabeçalho
- **WHEN** uma tabela renderiza
- **THEN** o cabeçalho tem fundo `muted` e texto de 12px/500

#### Scenario: Linha
- **WHEN** uma linha renderiza
- **THEN** tem no mínimo 56px de altura e borda superior

### Requirement: Painel lateral com a largura do canvas
O componente `Sheet` com `side="right"` SHALL ter 440px de largura máxima e 24px de padding, ocupando toda a largura em telas menores que 640px.

#### Scenario: Desktop
- **WHEN** um painel abre à direita
- **THEN** a largura é 440px

#### Scenario: Celular
- **WHEN** a largura é menor que 640px
- **THEN** o painel ocupa a largura toda

### Requirement: Comparação com o canvas das telas refeitas
Cada tela já refeita (casca, Imóveis, Inquilinos, Contratos, Recebimentos, Despesas, detalhe da cobrança e recibo) SHALL ser comparada com a artboard correspondente no desktop e no celular, e as diferenças encontradas SHALL ser registradas com a correção ou com a onda em que serão tratadas.

#### Scenario: Registro das diferenças
- **WHEN** a comparação de uma tela termina
- **THEN** o `design.md` lista cada diferença com tela, elemento, valor do canvas, valor do app e decisão

#### Scenario: Telas antigas
- **WHEN** uma tela fora da lista usa um componente ajustado
- **THEN** ela é conferida para não quebrar e as diferenças que sobrarem ficam como pendência da onda da sua seção


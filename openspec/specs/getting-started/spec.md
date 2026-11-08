# getting-started Specification

## Purpose
TBD - created by archiving change redesign-hoje. Update Purpose after archive.
## Requirements
### Requirement: Conta nova mostra os primeiros passos
Enquanto a organização não tiver nenhum contrato, a tela Hoje SHALL substituir as listas por "Primeiros passos" com barra de progresso ("N de 5") e os passos Criar sua conta (sempre feito), Cadastrar o primeiro imóvel, Cadastrar um inquilino, Criar o contrato e Definir como você recebe, e SHALL mostrar o cartão "Importar planilha" levando a `/import`. Os indicadores aparecem zerados.

#### Scenario: Conta recém-criada
- **WHEN** a organização não tem imóvel, inquilino, contrato nem chave Pix
- **THEN** aparece "1 de 5" e o botão do primeiro passo pendente leva ao cadastro de imóvel

#### Scenario: Progresso derivado
- **WHEN** há um imóvel e um inquilino, mas nenhum contrato
- **THEN** aparece "3 de 5" e o passo do contrato fica habilitado

#### Scenario: Contrato depende de imóvel e inquilino
- **WHEN** falta imóvel ou inquilino
- **THEN** o passo Criar o contrato aparece esmaecido e sem botão

#### Scenario: Primeiro contrato
- **WHEN** a organização cria o primeiro contrato
- **THEN** os primeiros passos somem e a tela mostra as listas do dia


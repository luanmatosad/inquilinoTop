# property-registry Specification

## Purpose
TBD - created by archiving change mvp-cadastros. Update Purpose after archive.
## Requirements
### Requirement: Cadastro completo de imóvel
O sistema SHALL permitir cadastrar imóvel com tipo (`RESIDENTIAL`, `COMMERCIAL` ou `SINGLE`), nome, endereço, número, complemento, bairro, cidade, UF e CEP, escopado à organização do usuário. Número e complemento são opcionais.

#### Scenario: Criação com CEP
- **WHEN** o usuário envia nome, tipo e `postal_code` com 8 dígitos
- **THEN** o sistema cria o imóvel e retorna 201 com o CEP sem máscara

#### Scenario: CEP inválido
- **WHEN** o `postal_code` não tem 8 dígitos
- **THEN** o sistema retorna 400 `INVALID_BODY`

#### Scenario: SINGLE cria unidade
- **WHEN** o usuário cria um imóvel do tipo `SINGLE`
- **THEN** o sistema cria automaticamente a unidade "Unidade 01"

#### Scenario: COMMERCIAL não cria unidade
- **WHEN** o usuário cria um imóvel do tipo `COMMERCIAL`
- **THEN** o sistema cria o imóvel sem unidades e retorna 201

#### Scenario: Tipo desconhecido
- **WHEN** o usuário envia um `type` diferente de `RESIDENTIAL`, `COMMERCIAL` e `SINGLE`
- **THEN** o sistema retorna 400

#### Scenario: Número e complemento
- **WHEN** o usuário envia `number` "120" e `complement` "Bloco B"
- **THEN** o imóvel é criado e a resposta devolve os dois campos

#### Scenario: Número longo demais
- **WHEN** `number` passa de 20 caracteres ou `complement` passa de 100
- **THEN** o sistema retorna 400

### Requirement: Dados da unidade
O sistema SHALL permitir informar rótulo, andar, área em m², quartos e banheiros de uma unidade.

#### Scenario: Unidade com área
- **WHEN** o usuário envia rótulo e `area_m2` maior que zero
- **THEN** o sistema cria a unidade com a área informada

#### Scenario: Área negativa
- **WHEN** `area_m2`, `bedrooms` ou `bathrooms` é negativo
- **THEN** o sistema retorna 400

### Requirement: Unicidade do rótulo da unidade
O sistema SHALL rejeitar rótulo de unidade repetido, sem diferenciar maiúsculas, dentro do mesmo imóvel entre unidades ativas.

#### Scenario: Rótulo repetido
- **WHEN** o usuário cria unidade "Apto 101" e já existe "apto 101" ativa no imóvel
- **THEN** o sistema retorna 409 `DUPLICATE_UNIT_LABEL`

#### Scenario: Rótulo de unidade excluída
- **WHEN** a unidade com o mesmo rótulo está com `is_active=false`
- **THEN** o sistema permite a criação

### Requirement: Isolamento e exclusão lógica
O sistema SHALL filtrar imóveis e unidades por `organization_id` e excluir apenas com `is_active=false`.

#### Scenario: Imóvel de outra organização
- **WHEN** o usuário acessa o id de imóvel de outra organização
- **THEN** o sistema retorna 404

#### Scenario: Exclusão
- **WHEN** o usuário exclui um imóvel
- **THEN** o imóvel é marcado `is_active=false` e sai da listagem

### Requirement: Telas de imóveis em rota única
O frontend SHALL oferecer lista, criação, edição e detalhe de imóveis e unidades somente em `/properties/**`, e SHALL redirecionar as rotas antigas de página cheia para a nova navegação.

#### Scenario: Rota antiga
- **WHEN** o usuário acessa `/owner/properties`
- **THEN** é redirecionado permanentemente para `/properties`

#### Scenario: Cadastro antigo
- **WHEN** o usuário acessa `/properties/new`
- **THEN** é redirecionado para `/properties?novo=1` e o painel de cadastro abre

#### Scenario: Edição antiga
- **WHEN** o usuário acessa `/properties/<id>/edit`
- **THEN** é redirecionado para `/properties/<id>?aba=informacoes`

#### Scenario: Estados da lista
- **WHEN** a lista carrega, está vazia ou falha
- **THEN** a tela mostra respectivamente carregamento, estado vazio com a ação "Cadastrar imóvel" e mensagem de erro com nova tentativa

### Requirement: Lista de imóveis em tabela
A lista de `/properties` SHALL mostrar os imóveis em tabela com Imóvel (nome e endereço), Tipo, Unidades e Ocupação, SHALL permitir buscar por nome, endereço ou cidade e filtrar por tipo, e SHALL exibir o endereço composto por logradouro, número, complemento, bairro, cidade e UF.

#### Scenario: Linha da tabela
- **WHEN** existe o imóvel "Ed. Aurora" com 3 unidades, 1 alugada
- **THEN** a linha mostra o nome, o endereço, o tipo "Residencial", "3" e "1 de 3 alugadas"

#### Scenario: Imóvel de unidade única
- **WHEN** o imóvel é `SINGLE` e sua unidade está alugada
- **THEN** o tipo aparece como "Casa" e a ocupação como "Alugada"

#### Scenario: Busca
- **WHEN** o usuário busca "jasmim"
- **THEN** só os imóveis cujo nome, endereço ou cidade contêm o termo aparecem

#### Scenario: Filtro por tipo
- **WHEN** o usuário filtra por Comercial
- **THEN** só imóveis `COMMERCIAL` aparecem e a URL guarda `?tipo=COMMERCIAL`

#### Scenario: Celular
- **WHEN** a largura da tela é menor que 768px
- **THEN** a tabela é substituída por uma lista de cards com os mesmos dados

### Requirement: Cadastro em painel lateral
O frontend SHALL cadastrar imóvel e unidade em painel lateral aberto por parâmetro de URL, usando os mesmos formulários validados, e SHALL fechar o painel e atualizar a lista após salvar.

#### Scenario: Abrir e fechar
- **WHEN** o usuário clica em "Cadastrar imóvel"
- **THEN** a URL ganha `?novo=1`, o painel abre, e o botão voltar do navegador o fecha

#### Scenario: Salvar
- **WHEN** o usuário preenche nome, tipo e demais campos válidos e confirma
- **THEN** o imóvel é criado, o painel fecha e a lista mostra o novo imóvel

#### Scenario: Erro de validação
- **WHEN** o usuário confirma sem nome
- **THEN** o painel permanece aberto com a mensagem de erro no campo

#### Scenario: Tipo e unidades
- **WHEN** o usuário escolhe o tipo Casa
- **THEN** o formulário informa que a unidade única é criada junto com o imóvel

#### Scenario: Celular
- **WHEN** a largura da tela é menor que 768px
- **THEN** o painel ocupa a tela inteira

### Requirement: Detalhe do imóvel em abas
O detalhe de `/properties/<id>` SHALL ter as abas Unidades e Informações, escolhidas por `?aba=`, com Unidades como padrão.

#### Scenario: Aba Unidades
- **WHEN** o usuário abre um imóvel
- **THEN** vê a tabela de unidades com Unidade, Andar, Área, Quartos, Banheiros, Situação e Inquilino

#### Scenario: Unidade alugada
- **WHEN** a unidade tem contrato ativo do inquilino "Marina Souza" desde 03/2025
- **THEN** a linha mostra "Alugada" e "Marina Souza" com "desde 03/2025"

#### Scenario: Aba Informações
- **WHEN** o usuário abre `?aba=informacoes`
- **THEN** vê o formulário de edição do imóvel com os valores atuais

#### Scenario: Adicionar unidade
- **WHEN** o usuário clica em "Adicionar unidade"
- **THEN** a URL ganha `?unidade=nova` e o painel de unidade abre

### Requirement: Remoção do atalho global de cadastro
A barra superior SHALL NOT oferecer o botão "Novo imóvel"; o cadastro SHALL ser iniciado na página de Imóveis.

#### Scenario: Topbar
- **WHEN** a barra superior é renderizada
- **THEN** não há botão "Novo imóvel"

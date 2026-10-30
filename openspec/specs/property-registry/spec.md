# property-registry Specification

## Purpose
TBD - created by archiving change mvp-cadastros. Update Purpose after archive.
## Requirements
### Requirement: Cadastro completo de imóvel
O sistema SHALL permitir cadastrar imóvel com tipo (`RESIDENTIAL` ou `SINGLE`), nome, endereço, bairro, cidade, UF e CEP, escopado à organização do usuário.

#### Scenario: Criação com CEP
- **WHEN** o usuário envia nome, tipo e `postal_code` com 8 dígitos
- **THEN** o sistema cria o imóvel e retorna 201 com o CEP sem máscara

#### Scenario: CEP inválido
- **WHEN** o `postal_code` não tem 8 dígitos
- **THEN** o sistema retorna 400 `INVALID_BODY`

#### Scenario: SINGLE cria unidade
- **WHEN** o usuário cria um imóvel do tipo `SINGLE`
- **THEN** o sistema cria automaticamente a unidade "Unidade 01"

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
O frontend SHALL oferecer lista, criação, edição e detalhe de imóveis e unidades somente em `/properties/**`.

#### Scenario: Rota antiga
- **WHEN** o usuário acessa `/owner/properties`
- **THEN** é redirecionado permanentemente para `/properties`

#### Scenario: Estados da lista
- **WHEN** a lista carrega, está vazia ou falha
- **THEN** a tela mostra respectivamente carregamento, estado vazio com ação de criar e mensagem de erro com nova tentativa


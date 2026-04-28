## ADDED Requirements

### Requirement: Cadastrar Imóvel
O sistema SHALL permitir que o proprietário adicione novos imóveis ao seu portfólio.

#### Scenario: Cadastro com sucesso
- **WHEN** o proprietário preenche os dados do imóvel e submete o formulário
- **THEN** o sistema salva o imóvel no banco de dados e exibe o novo imóvel na listagem

#### Scenario: Validação de campos obrigatórios
- **WHEN** o proprietário tenta salvar um imóvel sem preencher o endereço ou valor
- **THEN** o sistema exibe mensagens de erro nos campos obrigatórios e impede o cadastro

### Requirement: Listar Imóveis
O sistema SHALL listar todos os imóveis associados ao proprietário autenticado.

#### Scenario: Visualização da lista
- **WHEN** o proprietário acessa a página de imóveis
- **THEN** o sistema exibe uma tabela ou grade com os imóveis, seu status (ex: Alugado, Vazio) e dados principais

### Requirement: Editar Imóvel
O sistema SHALL permitir que o proprietário atualize as informações de um imóvel existente.

#### Scenario: Atualização com sucesso
- **WHEN** o proprietário altera o valor do aluguel ou características do imóvel e salva
- **THEN** o sistema atualiza o registro e reflete as mudanças na listagem

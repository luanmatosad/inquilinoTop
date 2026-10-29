## ADDED Requirements

### Requirement: Cadastro de inquilino PF e PJ
O sistema SHALL permitir cadastrar inquilino com nome, tipo de pessoa (`PF` ou `PJ`), e-mail, telefone, documento, endereço (CEP, logradouro, cidade, UF) e observações.

#### Scenario: Criação de PF
- **WHEN** o usuário envia nome, `person_type=PF` e CPF válido
- **THEN** o sistema cria o inquilino e retorna 201 com o documento só com dígitos

#### Scenario: Endereço opcional
- **WHEN** o usuário não envia endereço
- **THEN** o sistema cria o inquilino sem endereço

### Requirement: Validação do documento
O sistema SHALL validar o documento conforme o tipo: CPF para `PF` e CNPJ para `PJ`, incluindo dígitos verificadores.

#### Scenario: CPF inválido
- **WHEN** `person_type=PF` e o CPF tem dígito verificador incorreto
- **THEN** o sistema retorna 400 `INVALID_DOCUMENT`

#### Scenario: Documento incompatível
- **WHEN** `person_type=PJ` e o documento tem 11 dígitos
- **THEN** o sistema retorna 400 `INVALID_DOCUMENT`

### Requirement: Documento único na organização
O sistema SHALL impedir dois inquilinos ativos com o mesmo documento na mesma organização.

#### Scenario: Duplicidade
- **WHEN** o usuário cria ou atualiza um inquilino com documento já usado por outro ativo
- **THEN** o sistema retorna 409 `DUPLICATE_DOCUMENT`

#### Scenario: Mesmo documento em outra organização
- **WHEN** outra organização já usa o mesmo documento
- **THEN** o sistema permite o cadastro

#### Scenario: Reuso após exclusão
- **WHEN** o inquilino com o documento está com `is_active=false`
- **THEN** o sistema permite novo cadastro com o mesmo documento

### Requirement: Isolamento e exclusão lógica
O sistema SHALL filtrar inquilinos por `organization_id` e excluir apenas com `is_active=false`.

#### Scenario: Listagem isolada
- **WHEN** o usuário lista inquilinos
- **THEN** recebe só os da sua organização, e `[]` quando não há nenhum

#### Scenario: Inquilino com contrato ativo
- **WHEN** o usuário exclui inquilino com contrato `ACTIVE`
- **THEN** o sistema retorna 409 e mantém o cadastro ativo

### Requirement: Telas de inquilinos em rota única
O frontend SHALL oferecer lista, criação, edição e detalhe de inquilinos somente em `/tenants/**`, com máscara para CPF/CNPJ, CEP e telefone.

#### Scenario: Rota antiga
- **WHEN** o usuário acessa `/owner/tenants`
- **THEN** é redirecionado permanentemente para `/tenants`

#### Scenario: Erro de duplicidade na tela
- **WHEN** o backend retorna `DUPLICATE_DOCUMENT`
- **THEN** o formulário exibe a mensagem junto ao campo de documento

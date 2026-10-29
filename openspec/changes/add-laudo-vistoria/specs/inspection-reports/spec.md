## ADDED Requirements

### Requirement: Criar laudo de vistoria
O sistema SHALL permitir criar um laudo de vistoria do tipo `ENTRY` ou `EXIT` vinculado a um contrato da organização do usuário, com data da vistoria e observações gerais, iniciando em `DRAFT`.

#### Scenario: Criação bem-sucedida
- **WHEN** um usuário autenticado envia tipo, `lease_id` válido da sua organização e `inspected_at`
- **THEN** o sistema cria o laudo com status `DRAFT` e retorna 201

#### Scenario: Contrato de outra organização
- **WHEN** o `lease_id` pertence a outra organização
- **THEN** o sistema retorna 404 `NOT_FOUND` e não cria o laudo

#### Scenario: Laudo duplicado
- **WHEN** já existe laudo ativo do mesmo tipo para o contrato
- **THEN** o sistema retorna 409 e não cria um segundo

#### Scenario: Tipo inválido
- **WHEN** o tipo não é `ENTRY` nem `EXIT`
- **THEN** o sistema retorna 400 `INVALID_BODY`

### Requirement: Itens do laudo
O sistema SHALL permitir adicionar, editar e remover itens de um laudo em `DRAFT`, cada um com ambiente, item, condição (`GOOD`, `FAIR`, `POOR`, `DAMAGED`, `NOT_APPLICABLE`) e observações.

#### Scenario: Adicionar item
- **WHEN** o usuário envia ambiente, item e condição válidos para um laudo `DRAFT`
- **THEN** o sistema cria o item e retorna 201

#### Scenario: Condição inválida
- **WHEN** a condição não está na lista permitida
- **THEN** o sistema retorna 400 e não cria o item

#### Scenario: Remoção por soft-delete
- **WHEN** o usuário remove um item
- **THEN** o sistema marca `is_active=false` e o item deixa de aparecer na listagem

### Requirement: Pré-preencher saída a partir da entrada
O sistema SHALL permitir criar um laudo `EXIT` copiando os itens do laudo `ENTRY` do mesmo contrato.

#### Scenario: Cópia dos itens
- **WHEN** o usuário cria um `EXIT` com `copy_from_entry=true` e existe `ENTRY` ativo no contrato
- **THEN** o novo laudo contém os mesmos ambientes e itens do `ENTRY`, para reavaliação de condição

#### Scenario: Sem laudo de entrada
- **WHEN** `copy_from_entry=true` e não existe `ENTRY` ativo
- **THEN** o sistema cria o `EXIT` sem itens

### Requirement: Concluir laudo
O sistema SHALL permitir concluir um laudo `DRAFT` com pelo menos um item, tornando-o imutável.

#### Scenario: Conclusão bem-sucedida
- **WHEN** o usuário conclui um laudo `DRAFT` com itens
- **THEN** o status passa a `COMPLETED`, `completed_at` é preenchido e um registro de auditoria é criado

#### Scenario: Laudo sem itens
- **WHEN** o usuário tenta concluir um laudo sem itens
- **THEN** o sistema retorna 422 e mantém `DRAFT`

#### Scenario: Edição após conclusão
- **WHEN** o usuário tenta editar o laudo ou seus itens com status `COMPLETED`
- **THEN** o sistema retorna 409 `INSPECTION_NOT_EDITABLE`

### Requirement: Fotos dos itens
O sistema SHALL permitir anexar fotos a um item de laudo usando o módulo de documentos com `entity_type` `inspection_item`.

#### Scenario: Upload de foto
- **WHEN** o usuário envia imagem de até 10 MB para um item do seu laudo `DRAFT`
- **THEN** o sistema armazena o arquivo e o associa ao item

#### Scenario: Item de outra organização
- **WHEN** o item pertence a laudo de outra organização
- **THEN** o sistema retorna 404 e não armazena o arquivo

### Requirement: Comparar entrada e saída
O sistema SHALL retornar a comparação entre o laudo `ENTRY` e o `EXIT` concluídos de um contrato, pareando itens por ambiente e item.

#### Scenario: Item piorou
- **WHEN** a condição na saída é pior que na entrada (ordem `GOOD` < `FAIR` < `POOR` < `DAMAGED`)
- **THEN** o par vem com `worsened=true`

#### Scenario: Item só em um lado
- **WHEN** um item existe só na entrada ou só na saída
- **THEN** o par vem com o outro lado nulo e `worsened=false`

#### Scenario: Laudo ausente
- **WHEN** falta o laudo de entrada ou de saída concluído
- **THEN** o sistema retorna 409

### Requirement: Isolamento por organização e soft-delete
O sistema SHALL filtrar todas as leituras e escritas de laudos e itens por `organization_id` e excluir apenas via `is_active=false`.

#### Scenario: Listagem isolada
- **WHEN** um usuário lista laudos
- **THEN** recebe somente os da sua organização, e uma lista vazia como `[]`

#### Scenario: Exclusão de laudo
- **WHEN** o usuário exclui um laudo
- **THEN** o laudo é marcado `is_active=false` e não aparece mais na listagem nem conta para a unicidade por tipo

### Requirement: Telas de laudo no frontend
O frontend SHALL oferecer lista, criação/edição, detalhe e comparação de laudos, consumindo a Go API.

#### Scenario: Lista de laudos
- **WHEN** o usuário acessa a tela de laudos
- **THEN** vê tipo, contrato, data, status e ações, com estados de carregamento, vazio e erro

#### Scenario: Itens agrupados por ambiente
- **WHEN** o usuário abre um laudo
- **THEN** os itens aparecem agrupados por ambiente com condição e fotos

#### Scenario: Comparação destacada
- **WHEN** o usuário abre a comparação de um contrato
- **THEN** itens com `worsened=true` aparecem destacados

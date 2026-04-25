## ADDED Requirements

### Requirement: User can create support ticket
O sistema SHALL permitir que usuários autenticados criem tickets de suporte com tipo, assunto e descrição.

#### Scenario: Successful ticket creation
- **WHEN** usuário preenche tipo, assunto e descrição e clica em "Enviar"
- **THEN** sistema cria ticket no banco com status "open" e redireciona para lista de tickets

#### Scenario: Missing required fields
- **WHEN** usuário tenta enviar sem preencher campos obrigatórios
- **THEN** sistema exibe mensagens de erro e não cria ticket

### Requirement: User can view their tickets
O sistema SHALL listar todos os tickets do usuário autenticado ordenados por data decrescente.

#### Scenario: View tickets list
- **WHEN** usuário acessa /support/tickets
- **THEN** sistema exibe lista de tickets com: título, tipo, status, data de criação

#### Scenario: Empty tickets list
- **WHEN** usuário sem tickets acessa /support/tickets
- **THEN** sistema exibe mensagem "Nenhum ticket encontrado"

### Requirement: User can view ticket details
O sistema SHALL permitir que usuário visualize os detalhes de um ticket específico.

#### Scenario: View ticket detail
- **WHEN** usuário clica em um ticket da lista
- **THEN** sistema exibe página com todos os campos do ticket

#### Scenario: Unauthorized ticket access
- **WHEN** usuário tenta acessar ticket de outro usuário
- **THEN** sistema retorna erro 403
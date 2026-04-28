## ADDED Requirements

### Requirement: Listar Inquilinos
O sistema SHALL exibir uma lista de todos os inquilinos vinculados aos imóveis do proprietário.

#### Scenario: Visualização dos inquilinos
- **WHEN** o proprietário acessa a página de gestão de inquilinos
- **THEN** o sistema exibe os dados dos inquilinos, status de pagamento e imóveis vinculados

### Requirement: Visualizar Detalhes do Inquilino
O sistema SHALL permitir a visualização do perfil detalhado e histórico de um inquilino específico.

#### Scenario: Acesso ao perfil
- **WHEN** o proprietário clica em um inquilino na lista
- **THEN** o sistema abre uma tela detalhada com dados de contato, contratos associados e histórico

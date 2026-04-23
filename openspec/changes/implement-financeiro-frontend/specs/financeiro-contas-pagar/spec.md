## ADDED Requirements

### Requirement: View Accounts Payable
The system SHALL display a list of outgoing payments at `/financeiro/pagar`.

#### Scenario: User views accounts payable
- **WHEN** the user navigates to `/financeiro/pagar`
- **THEN** they see a table with columns: Vencimento, Fornecedor/Imposto, Categoria, Valor, Imóvel Vinculado, and Status
- **THEN** checkboxes are available on the left side of each row for batch actions

### Requirement: Filter and Search Payables
The system SHALL allow users to filter payables by category and search by text.

#### Scenario: User filters by category
- **WHEN** the user selects the "IPTU" category filter
- **THEN** the table updates to show only IPTU-related expenses

### Requirement: Batch Actions
The system SHALL support performing actions on multiple payables simultaneously.

#### Scenario: User pays multiple expenses
- **WHEN** the user selects multiple checkboxes and clicks "Pagar Selecionados"
- **THEN** the system marks the selected expenses as paid

## ADDED Requirements

### Requirement: View Accounts Receivable
The system SHALL display a list of incoming payments at `/financeiro/receber` with tabs for Aluguéis, Parcelas de Venda, and Taxas Condominiais.

#### Scenario: User views accounts receivable
- **WHEN** the user navigates to `/financeiro/receber`
- **THEN** they see a table with columns: Vencimento, Pagador, Imóvel/Contrato, Valor, Forma de Pagto, Status, and Ações
- **THEN** each row has a status badge (Pago, Pendente, or Atrasado)

### Requirement: Filter and Search Receivables
The system SHALL allow users to filter receivables by status and search by text.

#### Scenario: User filters by status
- **WHEN** the user selects the "Atrasado" filter
- **THEN** the table updates to show only late payments

### Requirement: Create New Receivable
The system SHALL provide a modal to generate a new charge.

#### Scenario: User creates a new charge
- **WHEN** the user clicks "Nova Cobrança"
- **THEN** a modal opens with fields for Selecionar Contrato, Data de Vencimento, Valor, and Multa
- **THEN** the modal displays a preview of the Boleto/PIX

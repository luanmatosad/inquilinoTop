## ADDED Requirements

### Requirement: View Property Owner Repasses
The system SHALL display a list of net payments owed to property owners at `/financeiro/repasses`.

#### Scenario: User views repasses
- **WHEN** the user navigates to `/financeiro/repasses`
- **THEN** they see a table with columns: Proprietário, Imóveis, Recebimento Bruto, Taxa ADM, Descontos, Valor Líquido, and Status do Repasse

### Requirement: View Repasse Extract
The system SHALL provide a detailed breakdown (extract) of a repasse.

#### Scenario: User views the extract modal
- **WHEN** the user clicks "Ver Extrato" on a repasse row
- **THEN** a modal opens showing the breakdown of calculations: Gross Rent, Admin Fee (-), Tax Retentions (-), Expense Deductions (-), and Net Total
- **THEN** the modal includes an "Aprovar e Gerar Transferência" button

### Requirement: Process Repasses
The system SHALL allow the user to initiate processing for the month's repasses.

#### Scenario: User processes monthly repasses
- **WHEN** the user clicks "Processar Repasses do Mês"
- **THEN** the system calculates and stages the repasses for approval

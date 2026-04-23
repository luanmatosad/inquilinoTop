## ADDED Requirements

### Requirement: Bank Reconciliation Interface
The system SHALL provide a split-view interface at `/financeiro/conciliacao` for matching bank statements with system records.

#### Scenario: User views the reconciliation page
- **WHEN** the user navigates to `/financeiro/conciliacao`
- **THEN** they see the imported bank statement on the left side and the system records on the right side

### Requirement: Match Indications
The system SHALL visually indicate the confidence of matches between bank and system records.

#### Scenario: System finds an exact match
- **WHEN** a bank record exactly matches a system record in value and date
- **THEN** the system displays a green link icon indicating an exact match

#### Scenario: System finds a partial match
- **WHEN** a bank record partially matches a system record
- **THEN** the system displays a yellow warning indicating a suggested match

### Requirement: Confirm Match
The system SHALL allow the user to confirm a reconciliation match.

#### Scenario: User confirms a match
- **WHEN** the user clicks "Confirmar Conciliação" on a row
- **THEN** the system provides visual feedback and fades out the row

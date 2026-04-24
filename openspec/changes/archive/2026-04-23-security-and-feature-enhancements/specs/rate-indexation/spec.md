## ADDED Requirements

### Requirement: Rate indexation calculation
The system SHALL calculate new rent based on the configured index (IPCA or IGP-M).

#### Scenario: Calculate IPCA adjustment
- **WHEN** a lease is adjusted by IPCA
- **THEN** the new rent = current rent * (1 + IPCA cumulative rate)

#### Scenario: Calculate IGP-M adjustment
- **WHEN** a lease is adjusted by IGP-M
- **THEN** the new rent = current rent * (1 + IGP-M cumulative rate)

### Requirement: Automatic adjustment notification
The system SHALL notify owners 30 days before contract adjustment.

#### Scenario: Notify before adjustment
- **WHEN** a contract will be adjusted in 30 days
- **THEN** an email notification is sent with the projected new rent

### Requirement: Manual confirmation
The system SHALL require manual confirmation before applying rate adjustment.

#### Scenario: Manual confirmation required
- **WHEN** auto-adjustment is available
- **THEN** the system requires owner confirmation before applying

### Requirement: Index history
The system SHALL maintain historical index values.

#### Scenario: Store index values
- **WHEN** new index values are published
- **THEN** they are stored for historical reference
## ADDED Requirements

### Requirement: System records import history
The system SHALL store each import operation with metadata.

#### Scenario: Record created on import
- **WHEN** user completes an import
- **THEN** system creates record with timestamp, user, file name, row count, status

#### Scenario: History shows all imports
- **WHEN** user views import history
- **THEN** system shows list sorted by date descending

### Requirement: User can view past import details
The system SHALL allow users to see details of any past import.

#### Scenario: View import details
- **WHEN** user clicks on import in history
- **THEN** system shows file name, date, user, total rows, successful rows, error rows

#### Scenario: Export error report
- **WHEN** user clicks "Exportar erros"
- **THEN** system downloads CSV with error rows for review
## ADDED Requirements

### Requirement: User can preview all data to be imported
The system SHALL display all parsed rows in a table format before user confirms import.

#### Scenario: Preview displays parsed data
- **WHEN** user navigates to preview
- **THEN** system shows table with all rows and column values

#### Scenario: Preview shows validation status per row
- **WHEN** rows have been validated
- **THEN** each row shows valid/invalid status with error details

#### Scenario: Preview allows filtering
- **WHEN** user clicks filter option
- **THEN** system shows only valid or only invalid rows
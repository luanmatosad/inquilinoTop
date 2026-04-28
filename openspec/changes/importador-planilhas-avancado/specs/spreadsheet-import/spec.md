## ADDED Requirements

### Requirement: User can upload spreadsheet file for import
The system SHALL allow users to upload Excel (.xlsx) or CSV files containing data to import into the system.

#### Scenario: Successful file upload
- **WHEN** user selects a valid .xlsx or .csv file and clicks "Upload"
- **THEN** system parses the file and displays column headers

#### Scenario: Invalid file type
- **WHEN** user selects a non-.xlsx/.csv file and clicks "Upload"
- **THEN** system displays error message "Arquivo inválido. Use arquivo .xlsx ou .csv."

#### Scenario: File too large
- **WHEN** user selects a file with more than 10,000 rows
- **THEN** system displays warning "Arquivo muito grande. Máximo 10,000 linhas."

### Requirement: User can map spreadsheet columns to system fields
The system SHALL allow users to map each spreadsheet column to a corresponding system field.

#### Scenario: Manual column mapping
- **WHEN** user selects a column from dropdown and assigns a system field
- **THEN** system saves the mapping

#### Scenario: Auto-detection of column names
- **WHEN** spreadsheet column name matches known field name (e.g., "cpf" → "cpf")
- **THEN** system auto-maps the column to the field

#### Scenario: Unmapped required fields
- **WHEN** user attempts to proceed with unmapped required fields
- **THEN** system shows error "Campo obrigatório não mapeado: <field>"

### Requirement: System validates imported data
The system SHALL validate each row against defined rules before import.

#### Scenario: Valid row passes validation
- **WHEN** row passes all validation rules
- **THEN** row is marked as valid in preview

#### Scenario: Missing required field
- **WHEN** row has empty value for required field
- **THEN** row is marked with error "Campo obrigatório: <field>"

#### Scenario: Invalid format
- **WHEN** value does not match expected format (e.g., invalid CPF)
- **THEN** row is marked with error "Formato inválido para <field>: <value>"

#### Scenario: Invalid value range
- **WHEN** numeric value is outside allowed range
- **THEN** row is marked with error "Valor fora do intervalo permitido para <field>"

### Requirement: User can preview import before committing
The system SHALL display a preview of all data to be imported with validation status.

#### Scenario: Preview shows all rows
- **WHEN** user clicks "Visualizar"
- **THEN** system displays table with all rows and validation status

#### Scenario: Preview shows error count
- **WHEN** any rows have validation errors
- **THEN** preview shows count of errors and highlights problematic rows

### Requirement: User can choose duplicate handling strategy
The system SHALL allow users to choose how to handle duplicates (existing records with same unique identifier).

#### Scenario: Skip duplicates
- **WHEN** user selects "Pular duplicados"
- **THEN** system skips rows matching existing records

#### Scenario: Update existing records
- **WHEN** user selects "Atualizar existentes"
- **THEN** system updates fields for matching records

#### Scenario: Create anyway
- **WHEN** user selects "Criar duplicado"
- **THEN** system creates new record (may have same unique field)

### Requirement: User can commit import
The system SHALL import all valid rows when user confirms the import.

#### Scenario: Successful import
- **WHEN** user clicks "Importar" and all rows are valid
- **THEN** system creates records and shows success message

#### Scenario: Partial import with errors
- **WHEN** user clicks "Importar" with some invalid rows
- **THEN** system imports only valid rows and shows error summary

### Requirement: System tracks import history
The system SHALL сохранять history of imports with timestamp, user, file name, and status.

#### Scenario: View import history
- **WHEN** user navigates to import history
- **THEN** system displays list of past imports

#### Scenario: View import details
- **WHEN** user clicks on past import
- **THEN** system shows details including row count and errors
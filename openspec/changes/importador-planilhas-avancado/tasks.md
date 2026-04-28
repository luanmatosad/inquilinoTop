## 1. Setup

- [x] 1.1 Add xlsx library to frontend dependencies
- [x] 1.2 Create import feature folder structure
- [x] 1.3 Add import history database migration

## 2. File Upload Component

- [x] 2.1 Create file upload component with drag-and-drop
- [x] 2.2 Implement file type validation (.xlsx, .csv)
- [x] 2.3 Implement row count validation (max 10,000)
- [x] 2.4 Integrate SheetJS for file parsing

## 3. Column Mapping

- [x] 3.1 Create column mapper UI component
- [x] 3.2 Implement auto-detection of field names
- [x] 3.3 Implement manual mapping dropdown
- [x] 3.4 Validate required fields are mapped

## 4. Data Validation

- [x] 4.1 Create validation rules engine
- [x] 4.2 Implement required field validation
- [x] 4.3 Implement format validation (CPF, CNPJ, email, phone)
- [x] 4.4 Implement range validation for numeric fields

## 5. Import Preview

- [x] 5.1 Create preview table component
- [x] 5.2 Display validation status per row
- [x] 5.3 Add filter for valid/invalid rows
- [x] 5.4 Show error count summary

## 6. Duplicate Handling

- [x] 6.1 Implement duplicate detection by unique fields
- [x] 6.2 Create duplicate resolution UI
- [x] 6.3 Implement skip/update/create strategies

## 7. Import Execution

- [x] 7.1 Create import API endpoint
- [x] 7.2 Implement bulk insert with transaction
- [x] 7.3 Handle partial failures gracefully
- [x] 7.4 Return import result summary

## 8. Import History

- [x] 8.1 Create import history table
- [x] 8.2 Implement history listing API
- [x] 8.3 Add import details view
- [x] 8.4 Implement error export functionality
## Why

Currently, InquilinoTop lacks a way to bulk import data from spreadsheets. Property managers need to manually enter data one record at a time, which is time-consuming and error-prone. An advanced spreadsheet importer will allow bulk data import with validation, column mapping, and error handling.

## What Changes

- Add new spreadsheet import feature supporting Excel (.xlsx) and CSV files
- Implement column-to-field mapping UI
- Add data validation rules (required fields, formats, ranges)
- Add duplicate detection with user choice (skip, update, create duplicate)
- Add detailed error reporting with row-level feedback
- Add import preview before committing
- Add import history and rollback capability

## Capabilities

### New Capabilities

- `spreadsheet-import`: Import tabular data from Excel/CSV files with validation, mapping, and error handling
- `import-preview`: Preview imported data before committing with validation results
- `import-history`: View past imports and their status

### Modified Capabilities

None at this time.

## Impact

- New frontend component for upload and mapping
- New API endpoints for import operations
- New database table for import history
- May integrate with existing domain models (properties, tenants, contracts)
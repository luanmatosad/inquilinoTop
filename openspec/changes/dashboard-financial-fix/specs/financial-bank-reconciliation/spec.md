## ADDED Requirements

### Requirement: Bank record listing
The system SHALL provide `GET /api/v1/financial/bank-records` returning imported bank transactions within a date range.

#### Scenario: Empty bank records initially
- **WHEN** `GET /api/v1/financial/bank-records` is called
- **THEN** an empty array is returned

#### Scenario: Filter by date range
- **WHEN** `GET /api/v1/financial/bank-records?from=2026-01-01&to=2026-01-31` is called
- **THEN** only records within that period are returned

### Requirement: Bank record import via CSV
The system SHALL accept a CSV file upload via `POST /api/v1/financial/bank-records/import` and parse bank transactions.

#### Scenario: CSV import
- **WHEN** `POST /api/v1/financial/bank-records/import` receives a CSV with columns `date,description,amount,type`
- **THEN** each row is parsed into a `BankRecord` and stored in the database
- **AND** returns `201 Created` with `{imported: N}` where N is the number of records

#### Scenario: Invalid CSV format
- **WHEN** `POST /api/v1/financial/bank-records/import` receives a malformed CSV
- **THEN** returns `400 Bad Request` with code `INVALID_CSV_FORMAT`

### Requirement: Bank reconciliation matching
The system SHALL match imported bank records against payments for reconciliation.

#### Scenario: Auto-match by date and amount
- **WHEN** a bank record of R$ 2,500 credit on 2026-05-10 matches a payment of R$ 2,500 with `due_date` 2026-05-10 and status `PAID`
- **THEN** the payment is marked as `RECONCILED`

#### Scenario: Manual review for unmatched records
- **WHEN** a bank record has no matching payment
- **THEN** it is flagged for manual review in the reconciliation UI
## ADDED Requirements

### Requirement: Transfer calculation from paid payments
The system SHALL calculate transfers based on paid rental payments, deducting the configured admin fee percentage.

#### Scenario: Transfer calculation
- **WHEN** a payment of R$ 3,000 is paid and admin fee is configured at 10%
- **THEN** a transfer record is created with `gross_receipt: 3000.00`, `admin_fee_amount: 300.00`, `net_value: 2700.00`

#### Scenario: Transfer status workflow
- **WHEN** a transfer is created
- **THEN** its initial status is `PENDING`
- **WHEN** admin marks transfer as `PROCESSED`
- **THEN** status changes to `PROCESSED`
- **WHEN** admin marks transfer as `TRANSFERRED`
- **THEN** status changes to `TRANSFERRED` and `transferred_at` is set

### Requirement: Transfer list with filters
The system SHALL return a list of transfers with optional filters by status, date range, and property.

#### Scenario: Filter by status
- **WHEN** `GET /api/v1/financial/transfers?status=PENDING` is called
- **THEN** only transfers with `status=PENDING` are returned

#### Scenario: Filter by date range
- **WHEN** `GET /api/v1/financial/transfers?from=2026-01-01&to=2026-03-31` is called
- **THEN** only transfers within that period are returned

### Requirement: Transfer belongs to organization
The system SHALL scope transfers to the user's organization.

#### Scenario: Transfer isolation by organization
- **WHEN** a user in organization `A` calls `GET /api/v1/financial/transfers`
- **THEN** only transfers from organization `A` are returned
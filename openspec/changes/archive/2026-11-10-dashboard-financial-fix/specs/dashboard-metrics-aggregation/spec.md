## ADDED Requirements

### Requirement: Dashboard metrics endpoint
The system SHALL provide a single endpoint `GET /api/v1/dashboard/metrics` that returns all dashboard metrics aggregated from the database.

#### Scenario: Metrics returns aggregated data
- **WHEN** an authenticated user calls `GET /api/v1/dashboard/metrics`
- **THEN** the system returns `total_properties`, `total_units`, `occupied_units`, `vacancy_rate`, `total_tenants`, `monthly_revenue`, `recent_payments`, `expiring_leases`

#### Scenario: Vacancy rate calculation
- **WHEN** a property has 10 units and 7 are occupied by active leases
- **THEN** `vacancy_rate` is `30.0` (percent)

#### Scenario: Expiring leases filters within 30 days
- **WHEN** dashboard metrics are requested
- **THEN** `expiring_leases` contains only leases ending within the next 30 days with status `ACTIVE`

#### Scenario: Recent payments limited to last 10
- **WHEN** dashboard metrics are requested
- **THEN** `recent_payments` contains at most the 10 most recent payments ordered by `due_date` desc

### Requirement: Monthly revenue by status
The system SHALL calculate monthly revenue grouping payments by status (`PAID`, `PENDING`, `OVERDUE`) within the current calendar month.

#### Scenario: Revenue with paid payments
- **WHEN** there are 3 payments in the current month with `PAID` status totaling R$ 7,500
- **THEN** `monthly_revenue.paid` is `7500.00`

#### Scenario: Overdue payments
- **WHEN** a payment has `due_date` before today and `status = PENDING`
- **THEN** it is counted in `monthly_revenue.overdue`

### Requirement: Dashboard reads from organization scope
The system SHALL filter all dashboard metrics by the user's organization context.

#### Scenario: User sees only their organization data
- **WHEN** a user with organization `A` calls `GET /api/v1/dashboard/metrics`
- **THEN** metrics include only properties, units, and payments belonging to organization `A`
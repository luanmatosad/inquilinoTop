## ADDED Requirements

### Requirement: Commission listing
The system SHALL provide `GET /api/v1/financial/commissions` returning a list of broker commissions based on leases.

#### Scenario: Empty commissions in MVP
- **WHEN** `GET /api/v1/financial/commissions` is called
- **THEN** an empty array is returned because `broker_id` is not yet implemented on leases

#### Scenario: Commissions scoped to organization
- **WHEN** a user in organization `A` calls `GET /api/v1/financial/commissions`
- **THEN** only commissions from organization `A` are returned

### Requirement: Commission calculation schema
The system SHALL calculate commission with the following formula when broker is assigned:
- `amount_to_pay = base_value * (percentage / 100) - iss_retention - irrf_retention`

#### Scenario: Commission with retention
- **WHEN** a lease has `broker_id` set, `rent_amount: 5000.00`, `commission_percentage: 10%`, `iss: 5%`, `irrf: 15%`
- **THEN** `base_value: 500.00`, `tax_retention_iss: 25.00`, `tax_retention_irrf: 71.25`, `amount_to_pay: 403.75`
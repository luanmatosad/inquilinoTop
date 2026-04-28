## ADDED Requirements

### Requirement: Manage Billing Defaults
The system SHALL allow landlords to store and retrieve default billing configurations (e.g., default late fee percentage, default daily interest) within the financial configuration's `config` JSON payload.

#### Scenario: Setting default fees
- **WHEN** the user submits an upsert request containing `default_late_fee` and `default_interest` inside the `config` payload
- **THEN** the backend successfully stores these values in the database and returns them on subsequent GET requests

#### Scenario: Frontend uses defaults
- **WHEN** the user navigates to the "Create Lease" page in the frontend
- **THEN** the frontend fetches the financial config and pre-fills the late fee and daily interest fields with the landlord's defaults (if defined)

## ADDED Requirements

### Requirement: Get Financial Configuration
The system SHALL provide an API endpoint to retrieve the authenticated owner's financial configuration.

#### Scenario: Config does not exist yet
- **WHEN** the authenticated user requests their config and no record exists in `financial_config`
- **THEN** the system returns a 200 OK with a `null` data payload

#### Scenario: Config exists
- **WHEN** the authenticated user requests their config and a record exists
- **THEN** the system returns a 200 OK with the config data (provider, config JSON, pix_key, bank_info)

### Requirement: Upsert Financial Configuration
The system SHALL provide an API endpoint to insert or update the owner's financial configuration using an upsert mechanism based on `owner_id`.

#### Scenario: First time creating config
- **WHEN** the authenticated user submits valid financial data and no config exists
- **THEN** the system inserts a new record linked to the owner's ID and returns a 200 OK with the new data

#### Scenario: Updating existing config
- **WHEN** the authenticated user submits valid financial data and a config already exists
- **THEN** the system updates the existing record and returns a 200 OK with the updated data

#### Scenario: Invalid provider
- **WHEN** the user submits a provider not in the allowed list (e.g., something other than `manual`, `asaas`)
- **THEN** the system returns a 400 Bad Request detailing the validation errors

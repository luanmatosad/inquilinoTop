## Context

The system has a `financial_config` table (from migration 000015) meant to store configuration specific to how a landlord receives payments: `provider` (e.g., asaas, mock), `config` (JSONB for API keys, environment settings), `pix_key`, and `bank_info`. However, there are no backend endpoints to read or update this data, nor a frontend page to capture it from the user. Without this data, the backend cannot orchestrate gateway integrations or populate billing instruments with correct Pix keys.

Additionally, landlords need a place to define default values for late fees and daily interest, so they don't have to input these manually every time they create a new lease.

## Goals / Non-Goals

**Goals:**
- Provide CRUD (Upsert) REST endpoints for `financial_config` in the backend.
- Create a frontend settings page (`/settings/financial`) to manage the Pix key, Bank details, Provider choice, and gateway configuration.
- Integrate the frontend UI with the new backend endpoints.

**Non-Goals:**
- Actually implementing the Asaas API integration logic (this change is strictly for the configuration layer/storage).
- Storing highly sensitive data like raw credit card numbers (we only store API keys which will be held in the JSONB `config` column).

## Decisions

1. **Domain Placement: `payment` vs. `identity` vs. `financial`**
   - **Decision**: Add the financial config endpoints to the existing `payment` domain (`backend/internal/payment/`).
   - **Rationale**: The financial config directly controls how payments are generated and processed. The `payment` domain is the primary consumer of this data when issuing charges. Creating a separate `financial` domain just for one table would add unnecessary boilerplate.

2. **Endpoint Design: Upsert Pattern**
   - **Decision**: Similar to user profiles, implement an upsert endpoint `PUT /api/v1/payments/config` utilizing PostgreSQL `ON CONFLICT (owner_id)`.
   - **Rationale**: Avoids issues with race conditions on first save and reduces the number of required API calls (no need to check if exists before POST/PUT).

3. **Schema Mapping for Default Rules**
   - **Decision**: For now, default rules for leases (like default late fee percentage) can be stored within the `config JSONB` column of the `financial_config` table, e.g., `{"default_late_fee": 2.0, "default_interest": 1.0}`.
   - **Rationale**: Keeps the schema flexible without requiring a new database migration. If these fields become heavily queried or indexed later, they can be extracted to dedicated columns.

## Risks / Trade-offs

- **Risk**: Storing third-party API Keys in plain text JSONB.
  - **Mitigation**: Long-term, these should be encrypted at rest. For the scope of this change, we will assume standard database security is sufficient, but we will document the need for application-level encryption as a future enhancement.
- **Risk**: JSONB schema validation.
  - **Mitigation**: The Go `UpdateFinancialConfigInput` struct will clearly define the expected JSON schema and the backend service must validate the structure before marshalling it into the database.

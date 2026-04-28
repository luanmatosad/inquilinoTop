## Context

Currently, the InquilinoTop system treats the landlord/administrator purely as an authentication entity (`users` table with email and password hash). There is no structure to store the landlord's personal or business information (Name, CPF/CNPJ, Contact, Address). This creates a blocker for downstream features like PDF lease generation, automated payment gateway integration (which requires KYC), and fiscal reporting.

## Goals / Non-Goals

**Goals:**
- Provide a database schema to store landlord profile data securely.
- Create REST API endpoints to read and update this profile data.
- Build a frontend user interface to manage this data.
- Update the application's global header to reflect the user's name.

**Non-Goals:**
- Implementation of PDF contract generation (this change only prepares the data layer).
- Integration with external payment gateways (this is a prerequisite, not the integration itself).
- Role-Based Access Control (RBAC) enhancements (this is just the profile data for the primary user/admin).

## Decisions

1. **Table Structure: `user_profiles` vs. adding to `users`**
   - **Decision**: Create a new table `user_profiles` linked 1-to-1 with `users`.
   - **Rationale**: Keeps the `users` table focused strictly on authentication and authorization (email, password hash, plan). Profile data is distinct from identity and can grow over time (e.g., adding addresses, avatars, preferences).
   
2. **Domain Placement: `identity` Domain**
   - **Decision**: The profile endpoints and logic will reside within the existing `identity` domain.
   - **Rationale**: A user profile is intrinsically tied to the user's identity. Endpoints like `GET /api/v1/auth/profile` naturally fit within this module without needing to spin up a new domain just for one table.

3. **Profile Creation Strategy: Upsert on Update**
   - **Decision**: The `PUT /api/v1/auth/profile` endpoint will perform an `upsert` (`INSERT ... ON CONFLICT (user_id) DO UPDATE`).
   - **Rationale**: Existing users in the database do not have a profile record. Upsert avoids the need to run a retroactive script to insert empty profile rows for all existing users. The `GET` endpoint will simply return `null` or a 404 for the profile data if it hasn't been created yet, which the frontend will handle gracefully by showing an empty form.

## Risks / Trade-offs

- **Risk**: Existing users will initially have no profile data, potentially breaking UI elements that expect a name.
  - **Mitigation**: The frontend `Header` component must gracefully fallback to a generic avatar icon or the user's email if the `full_name` is absent.
- **Risk**: Complex address or document validation rules.
  - **Mitigation**: Keep validation straightforward for now (regex for CPF/CNPJ, standard string limits) and rely on the database schema constraints.

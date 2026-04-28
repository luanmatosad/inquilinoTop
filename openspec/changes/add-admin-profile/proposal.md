## Why

Currently, the application only stores an email and password hash for the system administrator (landlord). The lack of structured legal and personal data (Name, CPF/CNPJ, Address, Phone) blocks critical business features: automatic generation of legally valid lease agreements, payment gateway KYC (Know Your Customer) required for automated billing, and necessary fiscal reporting (Dimob, IRRF, Carnê Leão).

## What Changes

- Create a new `user_profiles` table in the database linked to the `users` table via `user_id`.
- Add new REST API endpoints to the `identity` domain (`GET /api/v1/auth/profile`, `PUT /api/v1/auth/profile`) to retrieve and update profile information.
- Build a new frontend settings page (`/settings/profile`) where the user can manage their personal and business data.
- Update the global `Header` component to display the logged-in user's actual name (if available) instead of a generic icon.

## Capabilities

### New Capabilities
- `landlord-profile`: Manage the landlord/admin profile details including name, person type (PF/PJ), legal documents (CPF/CNPJ, RG), phone, and address.

### Modified Capabilities
- *None*

## Impact

- **Database**: Adds a new migration for `user_profiles`.
- **Backend API**: Expands the `identity` domain models, repository, service, and handler.
- **Frontend**: Adds a new route `/settings/profile` and modifies the `Header` component to display dynamic user info.
- **Integrations**: Unblocks future features like PDF generation and Payment Provider KYC.

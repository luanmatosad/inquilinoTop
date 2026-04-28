## Why

To automate payments and generate correct billing instruments (like receipts or automated payment links/Pix), the system needs to know where the money is going and how to charge for late payments. Implementing the financial configuration UI allows the landlord to define their preferred payment provider, set up their Pix key for direct transfers, and establish default rules for late fees and interest, closing the loop on automated financial management.

## What Changes

- Create backend service and handler methods in the `identity` or `payment` domain to expose the existing `financial_config` table via a REST API.
- Create frontend data access layers (server actions) to fetch and mutate the financial configuration.
- Build a new settings page (`/settings/financial`) in the frontend where the landlord can input their Pix Key, select their payment provider (e.g., manual, asaas), and define default penalty and interest rates.

## Capabilities

### New Capabilities
- `financial-config`: Manage the landlord's financial settings including Pix key, payment provider preferences, and bank information.
- `billing-defaults`: Manage default financial rules (like standard late fee percentage and daily interest) to be automatically applied to new leases.

### Modified Capabilities
- *None*

## Impact

- **Backend API**: New REST endpoints (`GET /api/v1/financial-config`, `PUT /api/v1/financial-config`) added to an appropriate domain (e.g., `payment` or a new `financial` config domain).
- **Frontend**: A new settings route (`/settings/financial`) providing forms to configure billing preferences and integrations.
- **Integrations**: Sets the groundwork necessary for the backend to start communicating with external payment gateways (e.g., Asaas webhook handling).

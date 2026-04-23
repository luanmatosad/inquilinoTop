## Why

This change aims to implement the frontend interfaces for the support and help system within InquilinoTop, bringing the support experience up to the newly defined design standards ("HeroUI-like" look). Currently, users lack a centralized, modern interface to view FAQs, get help, or open support tickets.

## What Changes

- Implementation of the Support Central ("Central de Suporte") dashboard, displaying categories (Financeiro, Contratos, App, Outros) and a search bar for knowledge base articles.
- Implementation of the Open New Ticket ("Abrir Novo Chamado") screen to allow users to contact the support team directly.
- Implementation of the Contacts ("Contatos") screen for alternative contact methods.
- Styling aligned with the InquilinoTop Core Design System (Inter font, fluid grid, ambient shadows, vibrant accents).

## Capabilities

### New Capabilities
- `support-central`: The main help dashboard including category navigation and search.
- `support-ticket`: The form and flow to open a new support ticket.
- `support-contacts`: Display of alternative support contact methods.

### Modified Capabilities
- (None)

## Impact

- **Frontend**: Adds new routes and views in the frontend web application (e.g., `/support`, `/support/new-ticket`, `/support/contacts`).
- **Design System**: Further adoption of the InquilinoTop Core Design System components (cards, forms, inputs) in the new pages.
- **Backend/API**: The UI will need to eventually integrate with support APIs (ticket creation, fetching articles/FAQs), though this change primarily focuses on the frontend construction per the provided templates.
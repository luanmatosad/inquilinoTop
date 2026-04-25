## Context

The InquilinoTop platform needs a Support Central ("Central de Suporte") module where users can access FAQs, search knowledge base articles, open support tickets, and find alternative contact methods. This aligns with the value proposition of providing excellent tenant and property management services.

The frontend uses Next.js with React Server Components, Tailwind CSS, lucide-react for icons, and HeroUI components. This module will reside under the `/support` route namespace. Since backend APIs for support tickets aren't implemented, the frontend will be built with mocked data.

## Goals / Non-Goals

**Goals:**
- Implement Support Central dashboard with category navigation and search.
- Implement "Abrir Novo Chamado" (Open New Ticket) form and flow.
- Implement "Contatos" (Contacts) screen for alternative support methods.
- Align styling with InquilinoTop Core Design System (Inter font, fluid grid, ambient shadows, vibrant accents).

**Non-Goals:**
- Implementing actual Go backend routes for support (API development out of scope).
- Integrating with real ticketing systems or email services.

## Decisions

- **Namespace Routing**: All support pages will live under `frontend/src/app/support/`.
- **Data Fetching Pattern**: Create mock data internally without a DAL structure since it's a simple feature.
- **Component Strategy**: Use existing UI components (cards, forms, inputs, buttons) from the design system.
- **Styling**: Follow the InquilinoTop color palette and spacing conventions.

## Risks / Trade-offs

- **Risk**: Hardcoded content vs. dynamic knowledge base.
  - *Mitigation*: Structure the data to be easily replaceable when APIs are available.
- **Risk**: Mobile responsiveness for complex forms.
  - *Mitigation*: Design forms to stack vertically on smaller screens.
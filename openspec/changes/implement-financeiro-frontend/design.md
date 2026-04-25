## Context

The current `InquilinoTop` platform focuses on property, tenant, and lease management. To fulfill its value proposition, it needs a robust Financial Module that allows real estate agencies to track cash flow, handle payments (accounts receivable and payable), perform bank reconciliations, compute broker commissions, and manage payouts to property owners. 

The frontend uses Next.js with React Server Components, Tailwind CSS, and `lucide-react` for icons. This module will reside under the `/financeiro` route namespace. Since the backend Go APIs for the finance module are not fully implemented yet, the frontend will be built to mock the data internally, allowing for a realistic prototype and UI validation before the final integration.

## Goals / Non-Goals

**Goals:**
- Implement a complete frontend suite for the financial module based on the high-fidelity prototype specifications.
- Create reusable components tailored to financial data presentation (e.g., Data Tables, KPI Cards, Status Badges, Split View Layouts for Reconciliation).
- Ensure the UX feels native to the existing InquilinoTop design language.
- Provide a clear, mocked state so stakeholders can evaluate the flow.

**Non-Goals:**
- Implementing the actual Go backend routes (API development is out of scope for this change).
- Integrating with real banking APIs (OFX/CNAB parsers or PIX generation) in this frontend step.
- Building the actual PDF/export systems for DIMOB/DARF in this phase (only the UI representation).

## Decisions

- **Namespace Routing**: All financial module pages will live under `frontend/src/app/financeiro/`. This isolates the financial concerns from basic property management.
- **Data Fetching Pattern**: We will create a `data/financeiro/dal.ts` (Data Access Layer) structure to handle mocked data requests. Once the backend is ready, this DAL will be swapped out to hit the Go API endpoints.
- **Component Strategy**: 
  - For tables with complex actions, we will use a custom robust table component or extend existing ones.
  - Modals/Dialogs will be managed using standard React state or existing UI components (e.g., Radix UI if available, or simple conditional rendering).
- **Styling**: Adhere to the defined color palette where semantic colors mean financial status: Green (`#22c55e`) for paid/incoming, Yellow (`#eab308`) for pending/warnings, Red (`#ef4444`) for late/outgoing/alerts.

## Risks / Trade-offs

- **Risk**: Mock data becoming outdated or misaligned with actual backend structures when they are built.
  - *Mitigation*: Base the mock schemas closely on the domain models described in the PRD (Product Requirements Document), focusing on `Vencimento`, `Valor`, `Status`, and explicit relationships (Property -> Owner).
- **Risk**: The "Split View" in bank reconciliation may be complex to handle on smaller screens.
  - *Mitigation*: Design the split view to stack vertically on mobile and tablet breakpoints, reserving the side-by-side view for desktop.

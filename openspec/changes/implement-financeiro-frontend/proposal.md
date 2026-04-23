## Why

The current system lacks a comprehensive frontend interface for the "Módulo Financeiro" (Financial Module). Implementing this module is critical to provide real estate agencies and landlords with a centralized dashboard to track revenues, expenses, defaults, broker commissions, and property owner payouts, fulfilling the core business value of the InquilinoTop platform.

## What Changes

- Create a new global navigation sidebar and layout specifically for the financial module.
- Implement the "Dashboard Financeiro" page with key metrics (KPIs) and cash flow charts.
- Implement the "Contas a Receber" page to track rents, sales installments, and condo fees.
- Implement the "Contas a Pagar" page to manage expenses like IPTU, condo fees, and maintenance.
- Implement the "Conciliação Bancária" split-view layout to match bank statements with system records.
- Implement the "Repasses a Proprietários" page to manage net payments to property owners.
- Implement the "Comissões" page to handle broker commissions and tax retentions.
- Create interactive dialogs for Extrato de Repasse and Nova Cobrança.

## Capabilities

### New Capabilities
- `financeiro-dashboard`: Provides an overview of the current month's finances, including revenue tracking, default index, total rental value (VGA), and total payouts.
- `financeiro-contas-receber`: Enables tracking and managing incoming payments (rents, sales installments, condo fees) with statuses (Paid, Pending, Late).
- `financeiro-contas-pagar`: Facilitates managing and paying expenses associated with properties (IPTU, DARF, maintenance).
- `financeiro-conciliacao`: Provides a split-view interface to match imported bank statements (OFX/CNAB) against internal system records.
- `financeiro-repasses`: Manages the calculation and approval of net payouts to property owners, deducting administration fees and taxes.
- `financeiro-comissoes`: Displays and manages broker commissions, including splits and tax retentions (ISS/IRRF).

### Modified Capabilities
- (None)

## Impact

- **Frontend Navigation**: The main application routing and sidebar will be expanded to include the `/financeiro` namespace.
- **Frontend Components**: New reusable UI components (Split View, KPI Cards, Status Badges) will be added to the design system.
- **Data Layer**: Mock data will be implemented for the prototype phase, which will eventually be connected to the Go backend API.

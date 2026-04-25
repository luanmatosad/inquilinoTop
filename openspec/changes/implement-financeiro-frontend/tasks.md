## 1. Setup and Routing

- [x] 1.1 Create the `/financeiro` route namespace in `frontend/src/app`
- [x] 1.2 Implement the Financial layout with a custom left sidebar (Dashboard, Contas a Receber, Contas a Pagar, etc.)
- [x] 1.3 Create the `data/financeiro/dal.ts` mock data layer and populate mock datasets for properties, tenants, and transactions.

## 2. Dashboard UI

- [x] 2.1 Implement the 4 KPI metric cards (Receita, Inadimplência, VGA, Total a Repassar) in `/financeiro/dashboard/page.tsx`
- [x] 2.2 Add the Date Picker for month selection in the dashboard header
- [x] 2.3 Implement the "Fluxo de Caixa" chart using a charting library (e.g., Recharts) or visual placeholders
- [x] 2.4 Implement the "Aging de Contas" side panel listing late tenants

## 3. Contas a Receber and Contas a Pagar

- [x] 3.1 Implement the data table component for `/financeiro/receber` with tabs and search filters
- [x] 3.2 Add the status badges (Pago, Pendente, Atrasado) to the receivables table
- [x] 3.3 Create the "Nova Cobrança" modal with its form fields and preview
- [x] 3.4 Implement the data table for `/financeiro/pagar` with category filters and checkboxes for batch actions

## 4. Conciliação Bancária

- [x] 4.1 Implement the split-view layout in `/financeiro/conciliacao`
- [x] 4.2 Build the Bank Statement list on the left side
- [x] 4.3 Build the System Records list on the right side
- [x] 4.4 Add the visual match indicators (Green exact match, Yellow partial match) and the confirm action

## 5. Repasses and Comissões

- [x] 5.1 Implement the repasses table in `/financeiro/repasses`
- [x] 5.2 Create the "Ver Extrato" modal showing the detailed breakdown (gross rent, admin fee, taxes, net total)
- [x] 5.3 Implement the broker commissions table in `/financeiro/comissoes` showcasing split hierarchies

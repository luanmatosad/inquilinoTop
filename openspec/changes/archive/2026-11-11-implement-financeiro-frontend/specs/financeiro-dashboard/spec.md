## ADDED Requirements

### Requirement: Dashboard KPIs and Overview
The system SHALL display a dashboard at `/financeiro/dashboard` showing key performance indicators for the current month.

#### Scenario: User views the financial dashboard
- **WHEN** the user navigates to `/financeiro/dashboard`
- **THEN** they see 4 KPI cards: "Receita Prevista vs. Realizada", "Índice de Inadimplência", "Valor Geral de Aluguel (VGA)", and "Total a Repassar"
- **THEN** they see a "Fluxo de Caixa" chart tracking revenues vs. expenses over the last 6 months
- **THEN** they see an "Aging de Contas" side panel listing late tenants

### Requirement: Month Selection
The system SHALL allow the user to change the month viewed on the dashboard.

#### Scenario: User changes the month
- **WHEN** the user interacts with the Date Picker in the dashboard header
- **THEN** the KPI metrics and charts update to reflect the selected month's data

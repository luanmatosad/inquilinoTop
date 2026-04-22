## ADDED Requirements

### Requirement: Tenants table with pagination
The tenants screen SHALL display a table with columns: Nome (with avatar), Email, Telefone, CPF/CNPJ, Status (badge), Ações (edit/delete).

#### Scenario: Tenants table loads
- **WHEN** user visits /tenants
- **THEN** tenants are displayed in table with pagination

#### Scenario: Tenant status badges
- **WHEN** tenant has status
- **THEN** badge shows: Ativo (blue), Pendente (orange), Inativo (gray)

### Requirement: New tenant button
The screen SHALL include "Novo Inquilino" button.

#### Scenario: User clicks new tenant
- **WHEN** user clicks "Novo Inquilino"
- **THEN** tenant form dialog opens

### Requirement: Tenant actions (hover)
Hovering a row SHALL show action buttons (edit, delete).

#### Scenario: User hovers tenant row
- **WHEN** user hovers over tenant row
- **THEN** action buttons become visible

### Requirement: Pagination controls
The table SHALL show pagination with page numbers and prev/next buttons.

#### Scenario: User pages through tenants
- **WHEN** user clicks next page
- **THEN** next page of tenants is displayed
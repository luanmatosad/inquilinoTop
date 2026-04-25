## ADDED Requirements

### Requirement: Unit details header
The unit details screen SHALL display unit identification (Apt 402), status badge, breadcrumb navigation, Edit button.

#### Scenario: Unit details loads
- **WHEN** user visits /units/[id]
- **THEN** unit details are displayed with header

### Requirement: Tenant card
The screen SHALL show tenant information: avatar, name, email, phone, CPF, move-in date.

#### Scenario: Unit has active tenant
- **WHEN** unit has active lease
- **THEN** tenant card displays tenant info

#### Scenario: Unit is vacant
- **WHEN** unit has no active lease
- **THEN** "Sem inquilino" message is shown

### Requirement: Receipts table
The screen SHALL display payment history table: Mês Referência, Vencimento, Valor, Status, Ação (download/notify).

#### Scenario: Receipts display
- **WHEN** lease has payments
- **THEN** payments are listed in table

### Requirement: Contract summary card
The screen SHALL show contract details: rent value, due day, period length, start date.

#### Scenario: Contract summary displays
- **WHEN** lease is active
- **THEN** contract card shows all details with primary color background

### Requirement: Quick actions
The screen SHALL show action buttons: Registrar Pagamento, Enviar Mensagem, Gerar Recibo Avulso, Encerrar Contrato.

#### Scenario: User clicks register payment
- **WHEN** user clicks "Registrar Pagamento"
- **THEN** payment form opens
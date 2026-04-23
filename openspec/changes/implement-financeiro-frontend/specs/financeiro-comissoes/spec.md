## ADDED Requirements

### Requirement: View Broker Commissions
The system SHALL display a list of broker commissions at `/financeiro/comissoes`.

#### Scenario: User views commissions
- **WHEN** the user navigates to `/financeiro/comissoes`
- **THEN** they see a table with columns: Corretor, Tipo (Venda/Locação), Valor Base, % Comissão, Retenção ISS/IRRF, and Valor a Pagar

### Requirement: Commission Splits
The system SHALL visually represent commission splits between multiple brokers.

#### Scenario: User views a split commission
- **WHEN** a transaction involves multiple brokers
- **THEN** the table displays the split hierarchy and individual amounts for each broker

## ADDED Requirements

### Requirement: Properties grid with cards
The properties screen SHALL display a grid of property cards (1 col mobile, 2 cols tablet, 3 cols desktop), each showing: image, type badge, property name, address, unit count, "Gerenciar" action.

#### Scenario: Property grid loads
- **WHEN** user visits /properties
- **THEN** properties are displayed in responsive grid

#### Scenario: Property cards show type badge
- **WHEN** property card displays type
- **THEN** badge shows "Residencial", "Comercial", or "Único"

### Requirement: Search and filters
The properties screen SHALL include search input and filter/sort buttons.

#### Scenario: User searches properties
- **WHEN** user types in search input
- **THEN** properties are filtered by name/address

#### Scenario: User applies filters
- **WHEN** user clicks Filters button
- **THEN** filter modal opens

### Requirement: New property button
The screen SHALL include "Novo Imóvel" button with plus icon.

#### Scenario: User clicks new property
- **WHEN** user clicks "Novo Imóvel"
- **THEN** navigate to /properties/new
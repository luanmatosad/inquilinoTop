## ADDED Requirements

### Requirement: Property details header
The property details screen SHALL display property name, type badge, Edit/Delete buttons, breadcrumb navigation.

#### Scenario: Property details loads
- **WHEN** user visits /properties/[id]
- **THEN** property details are displayed with header

### Requirement: Property image and info card
The screen SHALL show property image on left (or top on mobile), address, CEP, owner name, construction year.

#### Scenario: Property data displays
- **WHEN** property has image
- **THEN** image is displayed in card

### Requirement: Occupation stats card
The screen SHALL show occupation stats: Total (24), Ocupadas (22), Disponíveis (2), progress bar (91%).

#### Scenario: Occupation stats display
- **WHEN** property has units
- **THEN** occupation metrics are calculated and displayed

### Requirement: Units table
The screen SHALL show table of units with columns: Identificação, Andar, Status, Ações (edit/delete).

#### Scenario: Units table displays
- **WHEN** property has units
- **THEN** units are listed in table with pagination

#### Scenario: User adds unit
- **WHEN** user clicks "Adicionar Unidade"
- **THEN** unit form dialog opens
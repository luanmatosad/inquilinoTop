## ADDED Requirements

### Requirement: Dashboard with bento grid stats
The dashboard SHALL display 4 stat cards in bento grid layout: Total Imóveis (42), Inquilinos Ativos (38), Unidades Ocupadas (38/42 with progress bar), and Taxa de Vacância (9.5%).

#### Scenario: Dashboard loads
- **WHEN** user visits dashboard at /
- **THEN** 4 stat cards are displayed with real-time data

#### Scenario: Stats show trend indicators
- **WHEN** stats include comparison to previous period
- **THEN** trend arrow (up/down) with percentage is shown

### Requirement: Financial summary bar
The dashboard SHALL show a horizontal bar with 3 sections: Recebida (blue), Pendente (orange), Atrasada (red), with legend and values below.

#### Scenario: Financial bar displays
- **WHEN** financial data is available
- **THEN** bar shows proportional segments with R$ values

### Requirement: Recent activity list
The dashboard SHALL show recent activities list with icon, title, subtitle, timestamp, and "Ver todo histórico" button.

#### Scenario: Activity list loads
- **WHEN** user visits dashboard
- **THEN** recent activities are listed with most recent first
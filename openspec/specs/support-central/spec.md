# support-central Specification

## Purpose
TBD - created by archiving change implement-frontend-support. Update Purpose after archive.

## Requirements

### Requirement: Central de Suporte page layout
The system SHALL show the Support Central at `/support` with the title "Central de Suporte", a search bar, a grid of help category cards and a "Recent Articles" list.

#### Scenario: Page header and search bar
- **WHEN** a user opens `/support`
- **THEN** the page shows the title "Central de Suporte" and a search input with placeholder "Buscar artigos..."

#### Scenario: Four category cards
- **WHEN** a user opens `/support`
- **THEN** four category cards are shown: Financeiro (Wallet icon), Contratos (FileText icon), App (Smartphone icon) and Outros (MoreHorizontal icon)
- **AND** the grid has 2 columns on mobile and 4 on desktop

### Requirement: Article search filter
The system SHALL filter knowledge base articles in real time as the user types in the search bar.

#### Scenario: Typing filters articles
- **WHEN** a user types text in the search bar
- **THEN** the list of articles updates to match the text, without submitting a form

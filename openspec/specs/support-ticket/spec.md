# support-ticket Specification

## Purpose
TBD - created by archiving change implement-frontend-support. Update Purpose after archive.

## Requirements

### Requirement: New ticket form
The system SHALL show a form at `/support/new-ticket` to open a support ticket, with type select, subject, description, optional attachment and a submit button "Enviar Chamado".

#### Scenario: Form shows all fields
- **WHEN** a user opens `/support/new-ticket`
- **THEN** the form shows a type select (Dúvida, Sugestão, Reclamação, Outro), a subject input, a description textarea, an optional attachment button and the submit button "Enviar Chamado"

#### Scenario: Empty submission is blocked
- **WHEN** a user submits the form with required fields empty
- **THEN** the form is not sent and validation messages are shown

### Requirement: Ticket submission feedback
The system SHALL show a success toast after a valid ticket is submitted and then return the user to `/support`.

#### Scenario: Successful submit
- **WHEN** a user submits a valid ticket
- **THEN** a success toast is shown
- **AND** the user is redirected to `/support`

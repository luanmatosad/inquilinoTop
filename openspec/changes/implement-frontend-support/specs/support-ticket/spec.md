# Abrir Novo Chamado Specification

## Overview

The Open New Ticket screen allows users to contact the support team directly by filling out a form.

## UI/UX

### Layout
- Centered form card (max-width 600px)
- Stacked form fields with labels
- Submit button at bottom

### Components
- **Type Select**: Dropdown (Dúvida, Sugestão, Reclamação, Outro)
- **Subject Input**: Text input for ticket subject
- **Description Textarea**: Multi-line textarea
- **Attachment Button**: File picker (optional)
- **Submit Button**: Primary button, "Enviar Chamado"

### Visual Design
- Form card: white background, rounded-lg, shadow
- Inputs: full-width, border-gray-200, focus ring
- Button: primary brand color

## Functionality
- Form validation (required fields)
- Success message on submit (mocked)

## Acceptance Criteria
- [ ] Form displays with all fields
- [ ] Validation prevents empty submissions
- [ ] Success feedback on submit
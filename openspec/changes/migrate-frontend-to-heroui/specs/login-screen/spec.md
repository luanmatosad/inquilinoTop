## ADDED Requirements

### Requirement: Login screen with tabs
The login screen SHALL have segmented tabs for "Entrar" (Login) and "Cadastrar" (Register), email input with icon, password input with visibility toggle, and submit button "Acessar painel".

#### Scenario: User logs in with valid credentials
- **WHEN** user enters valid email and password and clicks "Acessar painel"
- **THEN** user is redirected to dashboard

#### Scenario: User logs in with invalid credentials
- **WHEN** user enters invalid email or password and clicks "Acessar painel"
- **THEN** error message is displayed

#### Scenario: User toggles password visibility
- **WHEN** user clicks eye icon on password field
- **THEN** password is shown/hidden

### Requirement: Registration tab
The registration tab SHALL display same form fields for new user registration.

#### Scenario: User clicks Register tab
- **WHEN** user clicks "Cadastrar" tab
- **THEN** form switches to registration mode

### Requirement: Forgot password link
The login screen SHALL include "Esqueceu a senha?" link.

#### Scenario: User clicks forgot password
- **WHEN** user clicks "Esqueceu a senha?"
- **THEN** password reset page is shown
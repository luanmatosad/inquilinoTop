## ADDED Requirements

### Requirement: User roles definition
The system SHALL support three roles: owner, admin, and viewer.

#### Scenario: Roles defined
- **WHEN** the system is initialized
- **THEN** the following roles exist: owner, admin, viewer

### Requirement: Role assignment
The system SHALL allow owners to assign roles to users within their account.

#### Scenario: Assign admin role
- **WHEN** an owner assigns admin role to a user
- **THEN** the user gains admin permissions for that account

#### Scenario: Assign viewer role
- **WHEN** an owner assigns viewer role to a user
- **THEN** the user can only read data (no create, update, delete)

### Requirement: Role-based access control
The system SHALL enforce role permissions on all endpoints.

#### Scenario: Admin creates property
- **WHEN** an admin user attempts to create a property
- **THEN** the request is allowed

#### Scenario: Viewer tries to create property
- **WHEN** a viewer user attempts to create a property
- **THEN** the request is rejected with HTTP 403 Forbidden

### Requirement: Owner has full access
The system SHALL grant owners full access to all operations in their account.

#### Scenario: Owner access
- **WHEN** an owner makes any request on their data
- **THEN** the request is always allowed
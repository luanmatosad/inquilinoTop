## ADDED Requirements

### Requirement: Organization is the root tenant entity
The system SHALL treat Organization as the root entity for data isolation. Every user, property, tenant, lease, and payment belongs to exactly one Organization. There is no cross-organization data access.

#### Scenario: New user registration creates Organization
- **WHEN** a new user registers via `POST /api/v1/auth/register`
- **THEN** the system creates an Organization with the user's name as default name and creates an OrganizationMember linking the user with role `owner`

#### Scenario: User without Organization cannot access domain data
- **WHEN** a user without Organization membership attempts to call any domain endpoint
- **THEN** the system returns `403 Forbidden` with code `NO_ORGANIZATION`

### Requirement: Organization CRUD for admins
The system SHALL allow users with `admin` or `owner` role to update the organization name.

#### Scenario: Admin updates organization name
- **WHEN** a user with `admin` role calls `PUT /api/v2/organizations/{id}` with `{name: "Nova Imobiliária"}`
- **THEN** the organization name is updated and returns `200 OK`

#### Scenario: Employee cannot update organization
- **WHEN** a user with `employee` role calls `PUT /api/v2/organizations/{id}`
- **THEN** the system returns `403 Forbidden`

### Requirement: Organization context in JWT
The system SHALL include `organization_id` in JWT access token claims. All domain endpoints receive organization context from the token, not from request parameters.

#### Scenario: JWT contains organization claim
- **WHEN** user authenticates via `POST /api/v1/auth/login`
- **THEN** the returned access token includes `organization_id` in the payload
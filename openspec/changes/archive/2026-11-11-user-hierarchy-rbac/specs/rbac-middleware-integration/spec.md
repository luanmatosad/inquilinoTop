## ADDED Requirements

### Requirement: RBAC middleware validates permissions before handler execution
The system SHALL apply the RBAC middleware to all protected routes, checking user role and scope before executing the domain handler.

#### Scenario: Request passes middleware with sufficient permission
- **WHEN** a user with `admin` role calls `POST /api/v1/properties` with valid body
- **THEN** the request passes through RBAC middleware and reaches the property handler

#### Scenario: Request blocked by middleware with insufficient permission
- **WHEN** a user with `viewer` role calls `POST /api/v1/properties`
- **THEN** the RBAC middleware returns `403 Forbidden` before the handler is reached

### Requirement: All domain routes protected by RBAC
The system SHALL protect all routes under `/api/v1/{property,tenant,lease,payment,expense,support}` with the RBAC middleware using org-context-aware permission checks.

#### Scenario: Property routes check `property:write` permission
- **WHEN** `POST /api/v1/properties` is called
- **THEN** middleware verifies the user has `property:write` in the current organization scope

#### Scenario: Tenant routes check `tenant:write` permission
- **WHEN** `POST /api/v1/tenants` is called
- **THEN** middleware verifies the user has `tenant:write` in the current organization scope

#### Scenario: Payment routes check `payment:write` permission
- **WHEN** `POST /api/v1/leases/{id}/payments` is called
- **THEN** middleware verifies the user has `payment:write` in the current organization scope
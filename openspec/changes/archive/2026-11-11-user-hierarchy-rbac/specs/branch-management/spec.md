## ADDED Requirements

### Requirement: Branches are subdivisions of an Organization
The system SHALL allow organizations to create Branches representing regions, offices, or departments. Branches belong to exactly one Organization.

#### Scenario: Admin creates a branch
- **WHEN** a user with `admin` or `owner` role calls `POST /api/v2/organizations/{orgId}/branches` with `{name: "Filial Centro"}`
- **THEN** a branch is created and returns `201 Created`

#### Scenario: Owner lists organization branches
- **WHEN** a user calls `GET /api/v2/organizations/{orgId}/branches`
- **THEN** the system returns all active branches of the organization

#### Scenario: Employee cannot create branches
- **WHEN** a user with `employee` role calls `POST /api/v2/organizations/{orgId}/branches`
- **THEN** the system returns `403 Forbidden`

### Requirement: Branches scope member access
The system SHALL scope a member's access to a specific branch when `branch_id` is set on their membership. Members without branch assignment have org-wide access.

#### Scenario: Branch-scoped member sees only branch data
- **WHEN** a user with `employee` role and `branch_id=XYZ` queries `GET /api/v1/properties`
- **THEN** the system returns only properties associated with branch `XYZ`

#### Scenario: Org-wide member sees all data
- **WHEN** a user with `manager` role and `branch_id=NULL` queries `GET /api/v1/properties`
- **THEN** the system returns all properties in the organization
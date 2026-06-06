## ADDED Requirements

### Requirement: Hierarchical role permissions
The system SHALL define permissions per role with inheritance. Higher roles inherit all permissions from lower roles.

Role hierarchy (highest to lowest): `owner > admin > manager > employee > viewer`

#### Scenario: Admin inherits employee permissions
- **WHEN** a user with `admin` role attempts to create a property
- **THEN** the request succeeds because `admin` inherits `property:write` from `employee`

#### Scenario: Viewer cannot write properties
- **WHEN** a user with `viewer` role attempts to `POST /api/v1/properties`
- **THEN** the system returns `403 Forbidden` with code `INSUFFICIENT_PERMISSION`

### Requirement: Permission matrix
The system SHALL enforce the following permission matrix:

| Permission | owner | admin | manager | employee | viewer |
|------------|-------|-------|---------|----------|--------|
| `org:read` | Y | Y | Y | Y | Y |
| `org:update` | Y | Y | N | N | N |
| `property:read` | Y | Y | Y | Y | Y |
| `property:write` | Y | Y | Y | Y | N |
| `property:delete` | Y | Y | Y | N | N |
| `tenant:read` | Y | Y | Y | Y | Y |
| `tenant:write` | Y | Y | Y | Y | N |
| `lease:read` | Y | Y | Y | Y | Y |
| `lease:write` | Y | Y | Y | Y | N |
| `payment:read` | Y | Y | Y | Y | Y |
| `payment:write` | Y | Y | Y | N | N |
| `member:invite` | Y | Y | N | N | N |
| `member:manage` | Y | Y | N | N | N |
| `branch:manage` | Y | Y | N | N | N |

### Requirement: Organization-wide and branch-scoped roles
The system SHALL evaluate roles against the organization scope or branch scope depending on where the role was assigned.

#### Scenario: Org-wide role grants access to all branches
- **WHEN** a user with `admin` role (org-wide) accesses properties from any branch
- **THEN** the request succeeds

#### Scenario: Branch-scoped role restricts access
- **WHEN** a user with `manager` role scoped to branch `B1` accesses properties of branch `B2`
- **THEN** the system returns `403 Forbidden`
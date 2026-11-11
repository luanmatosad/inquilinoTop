## ADDED Requirements

### Requirement: Admin invites member via email
The system SHALL allow `admin` or `owner` to invite a new member by email. An invitation token is generated and sent via email.

#### Scenario: Admin sends invitation
- **WHEN** a user with `admin` role calls `POST /api/v2/organizations/{orgId}/invites` with `{email: "func@imobiliaria.com", role: "employee", branch_id: null}`
- **THEN** an invitation is created with a unique token, email is sent, and returns `201 Created`

#### Scenario: Duplicate invitation is rejected
- **WHEN** an admin sends an invitation to an email that already has a pending invitation
- **THEN** the system returns `409 Conflict`

#### Scenario: Employee cannot invite members
- **WHEN** a user with `employee` role calls `POST /api/v2/organizations/{orgId}/invites`
- **THEN** the system returns `403 Forbidden`

### Requirement: Invited user accepts invitation
The system SHALL allow a user with a valid invitation token to accept it and join the organization with the designated role.

#### Scenario: Authenticated user accepts invitation
- **WHEN** an authenticated user calls `POST /api/v2/organizations/invites/{token}/accept`
- **THEN** an OrganizationMember is created with the role from the invitation, `accepted_at` is set, and returns `200 OK`

#### Scenario: Expired invitation is rejected
- **WHEN** a user calls `POST /api/v2/organizations/invites/{token}/accept` with an expired token
- **THEN** the system returns `400 Bad Request` with code `INVITE_EXPIRED`

#### Scenario: Email mismatch is rejected
- **WHEN** a user tries to accept an invitation sent to a different email
- **THEN** the system returns `403 Forbidden` with code `INVITE_EMAIL_MISMATCH`

### Requirement: Member removal
The system SHALL allow `admin` or `owner` to remove a member from the organization.

#### Scenario: Admin removes member
- **WHEN** a user with `admin` role calls `DELETE /api/v2/organizations/members/{memberId}`
- **THEN** the membership is soft-deleted and returns `200 OK`

#### Scenario: Owner cannot be removed
- **WHEN** an admin tries to remove a member with `owner` role
- **THEN** the system returns `403 Forbidden` with code `CANNOT_REMOVE_OWNER`

### Requirement: Role update
The system SHALL allow `admin` or `owner` to update a member's role.

#### Scenario: Admin promotes employee to manager
- **WHEN** a user with `admin` role calls `PUT /api/v2/organizations/members/{memberId}/role` with `{role: "manager"}`
- **THEN** the membership role is updated and returns `200 OK`

#### Scenario: Owner role cannot be changed by admin
- **WHEN** an admin tries to change a member's role to `owner`
- **THEN** the system returns `403 Forbidden` with code `CANNOT_SET_OWNER_ROLE`
## ADDED Requirements

### Requirement: Log authentication events
The system SHALL log all authentication events.

#### Scenario: Login event logged
- **WHEN** a user logs in
- **THEN** an audit log entry is created with: user_id, event_type, ip_address, timestamp

#### Scenario: Failed login logged
- **WHEN** a user fails to log in
- **THEN** an audit log entry is created with event_type FAILED_LOGIN

### Requirement: Log data mutations
The system SHALL log all create, update, and delete operations.

#### Scenario: Property created logged
- **WHEN** a property is created
- **THEN** an audit log entry is created with entity_type, entity_id, changes

#### Scenario: Property deleted logged
- **WHEN** a property is deleted
- **THEN** an audit log entry marks the deletion

### Requirement: Log permission denied
The system SHALL log all permission denied events.

#### Scenario: Permission denied logged
- **WHEN** a request is denied due to permission
- **THEN** an audit log entry is created with user_id, resource, action

### Requirement: Query audit logs
The system SHALL allow owners to query their audit logs.

#### Scenario: Query own audit logs
- **WHEN** an owner queries audit logs
- **THEN** only logs from their account are returned
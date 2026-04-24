## ADDED Requirements

### Requirement: Send notification
The system SHALL send notifications to users via email.

#### Scenario: Send payment reminder
- **WHEN** a payment is overdue
- **THEN** an email notification is sent to the owner

#### Scenario: Send contract expiring notification
- **WHEN** a contract expires in 30 days
- **THEN** an email notification is sent to the owner

### Requirement: Schedule notifications
The system SHALL allow scheduling notifications for future delivery.

#### Scenario: Schedule notification
- **WHEN** a user schedules a notification for a future date
- **THEN** the notification is queued and sent at the scheduled time

### Requirement: Notification preferences
The system SHALL allow users to configure notification preferences.

#### Scenario: Disable email notifications
- **WHEN** a user disables email notifications
- **THEN** no email notifications are sent

### Requirement: Retry failed notifications
The system SHALL retry failed notifications up to 3 times.

#### Scenario: Retry failed notification
- **WHEN** a notification fails to send
- **THEN** the system retries up to 3 times with exponential backoff
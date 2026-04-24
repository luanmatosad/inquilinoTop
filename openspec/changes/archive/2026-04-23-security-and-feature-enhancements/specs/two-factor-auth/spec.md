## ADDED Requirements

### Requirement: Enable 2FA
The system SHALL allow users to enable two-factor authentication.

#### Scenario: User enables 2FA
- **WHEN** a user requests to enable 2FA
- **THEN** the system generates a TOTP secret and QR code
- **AND** returns a setup URL for authenticator apps

### Requirement: 2FA login
The system SHALL require TOTP code during login when 2FA is enabled.

#### Scenario: Login with 2FA enabled
- **WHEN** a user with 2FA enabled enters email and password
- **THEN** the system prompts for TOTP code

#### Scenario: Invalid TOTP code
- **WHEN** a user enters an invalid TOTP code
- **THEN** the system rejects with error INVALID_2FA_CODE

### Requirement: Backup codes
The system SHALL generate 10 backup codes when 2FA is enabled.

#### Scenario: Generate backup codes
- **WHEN** a user enables 2FA
- **THEN** the system generates 10 unique backup codes
- **AND** each code can only be used once

### Requirement: Use backup code
The system SHALL accept backup codes when TOTP is unavailable.

#### Scenario: Login with backup code
- **WHEN** a user enters a valid backup code
- **THEN** the login is accepted and the backup code is marked as used

### Requirement: Disable 2FA
The system SHALL allow users to disable 2FA with correct TOTP or backup code.

#### Scenario: Disable 2FA
- **WHEN** a user with 2FA enabled provides valid TOTP code
- **THEN** 2FA is disabled
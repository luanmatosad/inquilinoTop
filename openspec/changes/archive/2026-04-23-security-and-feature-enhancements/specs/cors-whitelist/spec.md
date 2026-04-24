## ADDED Requirements

### Requirement: CORS whitelist configuration
The system SHALL only allow CORS requests from origins explicitly configured in CORS_ALLOWED_ORIGINS environment variable.

#### Scenario: Request from allowed origin
- **WHEN** a client makes a cross-origin request from an origin in the whitelist
- **THEN** the response includes Access-Control-Allow-Origin with the exact origin

#### Scenario: Request from disallowed origin
- **WHEN** a client makes a cross-origin request from an origin NOT in the whitelist
- **THEN** the request is rejected without CORS headers

### Requirement: CORS preflight handling
The system SHALL handle OPTIONS preflight requests for allowed origins.

#### Scenario: Preflight from allowed origin
- **WHEN** an OPTIONS preflight request comes from an allowed origin
- **THEN** the system returns 204 No Content with appropriate Access-Control headers

### Requirement: Allowed methods and headers
The system SHALL expose allowed HTTP methods and custom headers.

#### Scenario: CORS headers in response
- **WHEN** a cross-origin request is allowed
- **THEN** Access-Control-Allow-Methods includes: GET, POST, PUT, DELETE, OPTIONS
- **AND** Access-Control-Allow-Headers includes: Authorization, Content-Type

### Requirement: No credentials for wildcard
The system SHALL NOT allow credentials with wildcard origin.

#### Scenario: Wildcard origin attempt
- **WHEN** CORS_ALLOWED_ORIGINS contains "*"
- **THEN** the system rejects the configuration and logs a warning
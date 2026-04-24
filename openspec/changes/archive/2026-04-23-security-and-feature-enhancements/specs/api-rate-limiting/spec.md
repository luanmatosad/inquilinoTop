## ADDED Requirements

### Requirement: API rate limiting by IP address
The system SHALL limit incoming requests to a maximum of 100 requests per minute per IP address for unauthenticated endpoints.

#### Scenario: Normal request within limit
- **WHEN** an unauthenticated client makes a request within the rate limit
- **THEN** the request is processed normally

#### Scenario: Request exceeds IP limit
- **WHEN** an unauthenticated client makes more than 100 requests within 1 minute
- **THEN** the system returns HTTP 429 Too Many Requests with error code RATE_LIMIT_EXCEEDED

### Requirement: API rate limiting by authenticated user
The system SHALL limit authenticated users to a maximum of 200 requests per minute per user.

#### Scenario: Authenticated user within limit
- **WHEN** an authenticated user makes requests within the rate limit
- **THEN** the requests are processed normally

#### Scenario: Authenticated user exceeds limit
- **WHEN** an authenticated user makes more than 200 requests within 1 minute
- **THEN** the system returns HTTP 429 Too Many Requests with error code USER_RATE_LIMIT_EXCEEDED

### Requirement: Rate limit headers in response
The system SHALL include rate limit information in response headers.

#### Scenario: Rate limit headers present
- **WHEN** a client makes any API request
- **THEN** the response includes headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

### Requirement: Configurable rate limits
The system SHALL allow rate limits to be configured via environment variables.

#### Scenario: Custom rate limits via env vars
- **WHEN** RATE_LIMIT_IP and RATE_LIMIT_USER environment variables are set
- **THEN** the system uses the configured values instead of defaults
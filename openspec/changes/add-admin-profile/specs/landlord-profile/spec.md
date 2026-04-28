## ADDED Requirements

### Requirement: Get Landlord Profile
The system SHALL provide an API endpoint to retrieve the authenticated landlord's profile data.

#### Scenario: Profile does not exist yet
- **WHEN** the authenticated user requests their profile and no profile record exists in the database
- **THEN** the system returns a 200 OK with a `null` data payload

#### Scenario: Profile exists
- **WHEN** the authenticated user requests their profile and a profile record exists
- **THEN** the system returns a 200 OK with the profile data (name, document, person_type, phone, address)

### Requirement: Update Landlord Profile
The system SHALL provide an API endpoint to update the authenticated landlord's profile data using an upsert mechanism.

#### Scenario: First time creating profile
- **WHEN** the authenticated user submits valid profile data and no profile currently exists
- **THEN** the system inserts a new profile record linked to the user's ID and returns a 200 OK with the new data

#### Scenario: Updating existing profile
- **WHEN** the authenticated user submits valid profile data and a profile already exists
- **THEN** the system updates the existing profile record and returns a 200 OK with the updated data

#### Scenario: Invalid profile data
- **WHEN** the user submits profile data with missing required fields (e.g., person_type) or invalid formats
- **THEN** the system returns a 400 Bad Request detailing the validation errors

### Requirement: Display Profile Name in Header
The frontend global Header SHALL display the user's full name if available, falling back to a default state if not.

#### Scenario: User has a configured name
- **WHEN** the user's profile data includes a `full_name`
- **THEN** the Header displays the `full_name` instead of a generic avatar or email

#### Scenario: User has no profile data
- **WHEN** the user has no profile data or `full_name` is empty
- **THEN** the Header displays a generic user icon or email

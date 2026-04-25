## ADDED Requirements

### Requirement: Upload document
The system SHALL allow users to upload documents associated with entities.

#### Scenario: Upload PDF document
- **WHEN** a user uploads a PDF file for a property
- **THEN** the file is saved and associated with the property
- **AND** the system returns document metadata (id, filename, size, url)

#### Scenario: Upload with invalid type
- **WHEN** a user uploads an unsupported file type
- **THEN** the system rejects with error INVALID_FILE_TYPE

#### Scenario: File too large
- **WHEN** a user uploads a file larger than 10MB
- **THEN** the system rejects with error FILE_TOO_LARGE

### Requirement: Download document
The system SHALL allow users to download uploaded documents.

#### Scenario: Download document
- **WHEN** a user requests a document download
- **THEN** the system returns the file with correct Content-Type

### Requirement: Delete document
The system SHALL allow users to delete documents they uploaded.

#### Scenario: Delete own document
- **WHEN** a user deletes their own document
- **THEN** the document is removed from storage

### Requirement: List documents
The system SHALL list all documents for a given entity.

#### Scenario: List property documents
- **WHEN** a user lists documents for a property
- **THEN** all documents associated with that property are returned
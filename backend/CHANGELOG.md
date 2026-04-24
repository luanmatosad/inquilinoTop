# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Rate indexation support for leases (`index_values` table and endpoints)
- Automated lease adjustment via `/api/v1/leases/{id}/adjust`
- API v2 versioning support (accessible via `/api/v2` with `API-Version` header)
- Graceful shutdown for the API server

### Deprecated
- API v1 endpoints are marked for deprecation. Use `/api/v2` paths instead.

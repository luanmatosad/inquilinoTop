## 1. Database Schema

- [x] 1.1 Generate new database migration using `golang-migrate` for `user_profiles`.
- [x] 1.2 Write `UP` and `DOWN` SQL scripts for the `user_profiles` table (linked to `users.id` with fields for `full_name`, `document`, `person_type`, `phone`, `address_line`, `city`, `state`).

## 2. Backend Repository Layer

- [x] 2.1 Add `UserProfile` and `UpsertProfileInput` struct definitions to `backend/internal/identity/model.go`.
- [x] 2.2 Implement `GetProfile` method in `internal/identity/repository.go`.
- [x] 2.3 Implement `UpsertProfile` method in `internal/identity/repository.go` using PostgreSQL `ON CONFLICT (user_id) DO UPDATE`.
- [x] 2.4 Add repository unit tests for profile methods in `repository_test.go`.

## 3. Backend Service and Handler Layers

- [x] 3.1 Add `GetProfile` and `UpdateProfile` methods to `internal/identity/service.go`.
- [x] 3.2 Add handler methods in `internal/identity/handler.go` for the profile routes.
- [x] 3.3 Register `GET /profile` and `PUT /profile` routes in `internal/identity/handler.go` (under the auth middleware).
- [x] 3.4 Add unit tests for service and handler in `service_test.go` and `handler_test.go`.

## 4. Frontend Data Layer

- [x] 4.1 Define TypeScript interfaces for Profile in `frontend/src/types/`.
- [x] 4.2 Create server actions or API utilities in `frontend/src/app/settings/profile/actions.ts` (or equivalent data access layer) for GET and PUT profile.

## 5. Frontend UI: Settings Page

- [x] 5.1 Create a new page component at `frontend/src/app/settings/profile/page.tsx`.
- [x] 5.2 Build the Profile Form component supporting Name, CPF/CNPJ (with masking/validation), Contact, and Address fields.
- [x] 5.3 Integrate the form with the API endpoints to load existing data and save updates.

## 6. Frontend UI: Global Header

- [x] 6.1 Update `frontend/src/components/Header.tsx` to fetch or receive the user's `full_name` from the profile.
- [x] 6.2 Modify the user circle avatar display in the Header to show the name or initials when available, keeping the generic icon as a fallback.

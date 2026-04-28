## 1. Backend Repository

- [x] 1.1 Add `FinancialConfig` and `UpsertFinancialConfigInput` struct definitions to `backend/internal/payment/model.go`. Ensure `Config` is typed properly (e.g., as `map[string]any` or a custom struct using JSON encoding).
- [x] 1.2 Implement `GetFinancialConfig` method in `internal/payment/repository.go`.
- [x] 1.3 Implement `UpsertFinancialConfig` method in `internal/payment/repository.go` utilizing `ON CONFLICT (owner_id) DO UPDATE`.
- [x] 1.4 Write unit tests for the repository methods in `repository_test.go` (if exists, or a new `repository_config_test.go`).

## 2. Backend Service and Handler

- [x] 2.1 Implement `GetFinancialConfig` and `UpdateFinancialConfig` in `internal/payment/service.go`.
- [x] 2.2 Add `getFinancialConfig` and `updateFinancialConfig` methods to `internal/payment/handler.go`.
- [x] 2.3 Register routes: `GET /api/v1/payments/config` and `PUT /api/v1/payments/config` under the auth middleware in `handler.go`.
- [x] 2.4 Write unit tests for the new service and handler methods.

## 3. Frontend Data Layer

- [x] 3.1 Define TypeScript interface `FinancialConfig` and `UpsertFinancialConfigInput` in `frontend/src/types/index.ts`.
- [x] 3.2 Create server actions in `frontend/src/app/settings/financial/actions.ts` to call the GET and PUT endpoints.

## 4. Frontend UI

- [x] 4.1 Create the settings page component at `frontend/src/app/settings/financial/page.tsx`.
- [x] 4.2 Build the `FinancialForm` component supporting fields for `provider` (select: manual, asaas), `pix_key`, and the defaults (`default_late_fee`, `default_interest`) inside the config JSON.
- [x] 4.3 Integrate the form with the server actions to display existing data and save updates.
- [x] 4.4 Add a link in the Sidebar or Header settings menu (if applicable) to point to `/settings/financial`.

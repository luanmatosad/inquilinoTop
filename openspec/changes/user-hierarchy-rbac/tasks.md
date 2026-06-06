## 1. Database Migration

- [x] 1.1 Create migration `000031_create_organizations.sql` with tables: `organizations`, `branches`, `organization_members`, `organization_invites`
- [x] 1.2 Add `organization_id` column to `users` table (nullable)
- [x] 1.3 Add `organization_id` column to `properties` table (nullable)
- [x] 1.4 Add `organization_id` column to `tenants` table (nullable)
- [x] 1.5 Add `organization_id` column to `leases` table (nullable)
- [x] 1.6 Add `organization_id` column to `payments` table (nullable)
- [x] 1.7 Add `organization_id` column to `expenses` table (nullable)
- [x] 1.8 Create down migration for rollback

## 2. Seed Existing Users

- [x] 2.1 Create seed function to create organization for each existing user
- [x] 2.2 Create `organization_member` entry with role `owner` for each existing user
- [x] 2.3 Set `organization_id` on all existing resources (properties, tenants, leases, payments, expenses) to match owner's organization

## 3. Update Auth/JWT

- [x] 3.1 Update `pkg/auth/jwt.go` to include `organization_id` in JWT claims
- [x] 3.2 Add `OrganizationIDFromCtx` helper function in auth package
- [x] 3.3 Update `auth.Middleware` to set `organization_id` in context
- [x] 3.4 Update `identity/service.go` login to return `organization_id` in response

## 4. Create Organization Domain

- [x] 4.1 Create `backend/internal/organization/model.go` with Organization, Branch, Member, Invite structs
- [x] 4.2 Create `backend/internal/organization/repository.go` with CRUD methods
- [x] 4.3 Create `backend/internal/organization/service.go` with business logic
- [x] 4.4 Create `backend/internal/organization/handler.go` with routes
- [x] 4.5 Register organization handler in `main.go`

## 5. Create Member Invitation Domain

- [x] 5.1 Add invite methods to `organization/repository.go`: CreateInvite, GetInviteByToken, AcceptInvite, CancelInvite, ListInvites
- [x] 5.2 Add invite methods to `organization/service.go`: CreateInvite, AcceptInvite, ListInvites
- [x] 5.3 Add invite routes in `organization/handler.go`: POST /invites, GET /invites, DELETE /invites/{id}, POST /invites/{token}/accept

## 6. Update RBAC Service

- [x] 6.1 Extend `rbac/model.go` with new roles: admin, manager, employee, viewer (replace owner/admin/viewer)
- [x] 6.2 Create permission matrix in `rbac/service.go` with role inheritance
- [x] 6.3 Update `rbac/AssignRoleInput` to include organization_id and branch_id
- [x] 6.4 Add method `CheckPermission(organizationID, branchID, role, permission)` with hierarchy check
- [x] 7.1 Update `rbac/middleware.go` to check permission by action, not just role
- [x] 7.2 Update `main.go` to apply RBAC middleware to all domain routes
- [x] 7.3 Map each route to its required permission (property:write, tenant:read, etc.)
- [x] 7.4 Add `organization_id` and `branch_id` extraction in middleware context
- [x] 8.1 Update `property/repository.go` to filter by `organization_id` instead of `owner_id`
- [x] 8.2 Update `tenant/repository.go` to filter by `organization_id` instead of `owner_id`
- [x] 8.3 Update `lease/repository.go` to filter by `organization_id` instead of `owner_id`
- [x] 8.4 Update `payment/repository.go` to filter by `organization_id` instead of `owner_id`
- [x] 8.5 Update `expense/repository.go` to filter by `organization_id` instead of `owner_id`
- [x] 9.1 Update `property/model.go` to replace `OwnerID` with `OrganizationID`
- [x] 9.2 Update `tenant/model.go` to replace `OwnerID` with `OrganizationID`
- [x] 9.3 Update `lease/model.go` to replace `OwnerID` with `OrganizationID`
- [x] 9.4 Update `payment/model.go` to replace `OwnerID` with `OrganizationID`
- [x] 9.5 Update all domain services to get `organizationID` from context, not parameter
- [x] 10.1 Update `property/handler.go` to get ownerID from context (not param)
- [x] 10.2 Update `tenant/handler.go` to get ownerID from context
- [x] 10.3 Update `lease/handler.go` to get ownerID from context
- [x] 10.4 Update `payment/handler.go` to get ownerID from context
- [x] 10.5 Update `expense/handler.go` to get ownerID from context
- [x] 10.6 Update all domain handlers to pass `organizationID` to service layer
- [ ] 11.1 Update migration 000001 users table: add organization_id foreign key constraint
- [ ] 11.2 Update all existing migration down files that reference owner_id

## 12. Frontend: Team Management UI

- [ ] 12.1 Create `frontend/src/app/settings/team/page.tsx` with members list
- [ ] 12.2 Create invite member dialog/sheet
- [ ] 12.3 Create remove member action
- [ ] 12.4 Create role change dropdown
- [ ] 12.5 Add settings/team link to navigation

## 13. Frontend: Organization Context

- [ ] 13.1 Update `frontend/src/lib/go/client.ts` to store organization_id
- [ ] 13.2 Update `frontend/src/middleware.ts` to handle organization context
- [ ] 13.3 Update user context/hook to expose organization info

## 14. Testing

- [x] 14.1 Write unit tests for `rbac/service.go` permission matrix with inheritance
- [ ] 14.2 Write integration tests for organization CRUD
- [ ] 14.3 Write integration tests for invite flow
- [x] 14.4 Verify all existing tests pass after changes
- [x] 14.5 Test RBAC middleware blocks unauthorized actions
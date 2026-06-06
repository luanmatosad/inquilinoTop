package rbac_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRoleRepo struct {
	roles map[uuid.UUID][]rbac.UserRole
}

func newMockRoleRepo() *mockRoleRepo {
	return &mockRoleRepo{
		roles: make(map[uuid.UUID][]rbac.UserRole),
	}
}

func (m *mockRoleRepo) Create(_ context.Context, in rbac.CreateInput) (*rbac.UserRole, error) {
	role := rbac.UserRole{
		ID:             uuid.New(),
		UserID:         in.UserID,
		Role:           in.Role,
		OrganizationID: in.OrganizationID,
		BranchID:       in.BranchID,
	}
	m.roles[in.UserID] = append(m.roles[in.UserID], role)
	return &role, nil
}

func (m *mockRoleRepo) Delete(_ context.Context, userID uuid.UUID, role rbac.RoleType, orgID, branchID *uuid.UUID) error {
	roles := m.roles[userID]
	for i, r := range roles {
		if r.Role == role && (orgID == nil || r.OrganizationID == nil || *r.OrganizationID == *orgID) {
			copy(roles[i:], roles[i+1:])
			roles = roles[:len(roles)-1]
			m.roles[userID] = roles
			return nil
		}
	}
	return nil
}

func (m *mockRoleRepo) GetByUser(_ context.Context, userID uuid.UUID) ([]rbac.UserRole, error) {
	return m.roles[userID], nil
}

func (m *mockRoleRepo) GetByUserAndOrg(_ context.Context, userID, orgID uuid.UUID) ([]rbac.UserRole, error) {
	var result []rbac.UserRole
	for _, r := range m.roles[userID] {
		if r.OrganizationID != nil && *r.OrganizationID == orgID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *mockRoleRepo) HasRole(_ context.Context, userID uuid.UUID, role rbac.RoleType, orgID, branchID *uuid.UUID) (bool, error) {
	for _, r := range m.roles[userID] {
		if r.Role == role {
			if orgID == nil {
				return true, nil
			}
			if r.OrganizationID != nil && *r.OrganizationID == *orgID {
				return true, nil
			}
		}
	}
	return false, nil
}

func (m *mockRoleRepo) HasAnyRole(_ context.Context, userID, orgID uuid.UUID) (bool, error) {
	for _, r := range m.roles[userID] {
		if r.OrganizationID != nil && *r.OrganizationID == orgID {
			return true, nil
		}
	}
	return false, nil
}

func newTestService(t *testing.T) *rbac.Service {
	t.Helper()
	return rbac.NewService(newMockRoleRepo())
}

func TestService_AssignRole(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	orgID := uuid.New()

	err := svc.AssignRole(context.Background(), userID, rbac.RoleOwner, &orgID, nil)
	require.NoError(t, err)

	hasRole, err := svc.CheckPermission(context.Background(), userID, rbac.RoleOwner, &orgID, nil)
	require.NoError(t, err)
	assert.True(t, hasRole)
}

func TestService_AssignRole_Duplicate(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	orgID := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleAdmin, &orgID, nil)
	err := svc.AssignRole(context.Background(), userID, rbac.RoleAdmin, &orgID, nil)
	assert.Error(t, err)
}

func TestService_CheckPermission_NotFound(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	orgID := uuid.New()

	hasRole, err := svc.CheckPermission(context.Background(), userID, rbac.RoleOwner, &orgID, nil)
	require.NoError(t, err)
	assert.False(t, hasRole)
}

func TestService_RemoveRole(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	orgID := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleViewer, &orgID, nil)
	err := svc.RemoveRole(context.Background(), userID, rbac.RoleViewer, &orgID, nil)
	require.NoError(t, err)

	hasRole, err := svc.CheckPermission(context.Background(), userID, rbac.RoleViewer, &orgID, nil)
	require.NoError(t, err)
	assert.False(t, hasRole)
}

func TestService_GetUserRoles(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	org1 := uuid.New()
	org2 := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleOwner, &org1, nil)
	_ = svc.AssignRole(context.Background(), userID, rbac.RoleViewer, &org2, nil)

	roles, err := svc.GetUserRoles(context.Background(), userID)
	require.NoError(t, err)
	assert.Len(t, roles, 2)
}

func TestService_HasPermission_OwnerCanWrite(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	orgID := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleOwner, &orgID, nil)

	assert.True(t, rbac.HasPermission(rbac.RoleOwner, rbac.PermissionPropertyWrite))
	assert.True(t, rbac.HasPermission(rbac.RoleOwner, rbac.PermissionTenantWrite))
	assert.True(t, rbac.HasPermission(rbac.RoleOwner, rbac.PermissionOrgUpdate))
}

func TestService_HasPermission_ViewerCannotWrite(t *testing.T) {
	assert.False(t, rbac.HasPermission(rbac.RoleViewer, rbac.PermissionPropertyWrite))
	assert.False(t, rbac.HasPermission(rbac.RoleViewer, rbac.PermissionTenantWrite))
	assert.False(t, rbac.HasPermission(rbac.RoleViewer, rbac.PermissionLeaseWrite))
	assert.False(t, rbac.HasPermission(rbac.RoleViewer, rbac.PermissionOrgUpdate))
}

func TestService_HasPermission_ManagerCanWrite(t *testing.T) {
	assert.True(t, rbac.HasPermission(rbac.RoleManager, rbac.PermissionPropertyRead))
	assert.True(t, rbac.HasPermission(rbac.RoleManager, rbac.PermissionPropertyWrite))
	assert.True(t, rbac.HasPermission(rbac.RoleManager, rbac.PermissionTenantWrite))
	assert.True(t, rbac.HasPermission(rbac.RoleManager, rbac.PermissionLeaseWrite))
	assert.True(t, rbac.HasPermission(rbac.RoleManager, rbac.PermissionPaymentWrite))
}

func TestService_HasPermission_AdminInheritsLower(t *testing.T) {
	assert.True(t, rbac.HasPermission(rbac.RoleAdmin, rbac.PermissionPropertyWrite))
	assert.True(t, rbac.HasPermission(rbac.RoleAdmin, rbac.PermissionTenantWrite))
}

func TestService_GetUserPermissions_PicksHighest(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	orgID := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleViewer, &orgID, nil)

	perms, err := svc.GetUserPermissions(context.Background(), userID, orgID)
	require.NoError(t, err)
	assert.Contains(t, perms, rbac.PermissionPropertyRead)
	assert.NotContains(t, perms, rbac.PermissionPropertyWrite)
}

func TestRoleType_Values(t *testing.T) {
	assert.Equal(t, rbac.RoleType("owner"), rbac.RoleOwner)
	assert.Equal(t, rbac.RoleType("admin"), rbac.RoleAdmin)
	assert.Equal(t, rbac.RoleType("manager"), rbac.RoleManager)
	assert.Equal(t, rbac.RoleType("employee"), rbac.RoleEmployee)
	assert.Equal(t, rbac.RoleType("viewer"), rbac.RoleViewer)
}
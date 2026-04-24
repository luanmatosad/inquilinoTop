package rbac_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRoleType_Values(t *testing.T) {
	assert.Equal(t, rbac.RoleType("owner"), rbac.RoleOwner)
	assert.Equal(t, rbac.RoleType("admin"), rbac.RoleAdmin)
	assert.Equal(t, rbac.RoleType("viewer"), rbac.RoleViewer)
}

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
		ID:          uuid.New(),
		UserID:     in.UserID,
		Role:       in.Role,
		PropertyID: in.PropertyID,
	}
	m.roles[in.UserID] = append(m.roles[in.UserID], role)
	return &role, nil
}

func (m *mockRoleRepo) Delete(_ context.Context, userID uuid.UUID, role rbac.RoleType, propertyID *uuid.UUID) error {
	roles := m.roles[userID]
	for i, r := range roles {
		if r.Role == role && (propertyID == nil || r.PropertyID == nil || *r.PropertyID == *propertyID) {
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

func (m *mockRoleRepo) GetByUserAndProperty(_ context.Context, userID, propertyID uuid.UUID) ([]rbac.UserRole, error) {
	var result []rbac.UserRole
	for _, r := range m.roles[userID] {
		if r.PropertyID != nil && *r.PropertyID == propertyID {
			result = append(result, r)
		}
	}
	return result, nil
}

func (m *mockRoleRepo) HasRole(_ context.Context, userID uuid.UUID, role rbac.RoleType, propertyID *uuid.UUID) (bool, error) {
	for _, r := range m.roles[userID] {
		if r.Role == role {
			if propertyID == nil {
				return true, nil
			}
			if r.PropertyID != nil && *r.PropertyID == *propertyID {
				return true, nil
			}
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
	propertyID := uuid.New()

	err := svc.AssignRole(context.Background(), userID, rbac.RoleOwner, &propertyID)
	require.NoError(t, err)

	hasRole, err := svc.CheckPermission(context.Background(), userID, rbac.RoleOwner, &propertyID)
	require.NoError(t, err)
	assert.True(t, hasRole)
}

func TestService_AssignRole_Duplicate(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	propertyID := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleAdmin, &propertyID)
	err := svc.AssignRole(context.Background(), userID, rbac.RoleAdmin, &propertyID)
	assert.Error(t, err)
}

func TestService_CheckPermission_NotFound(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	propertyID := uuid.New()

	hasRole, err := svc.CheckPermission(context.Background(), userID, rbac.RoleOwner, &propertyID)
	require.NoError(t, err)
	assert.False(t, hasRole)
}

func TestService_RemoveRole(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	propertyID := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleViewer, &propertyID)
	err := svc.RemoveRole(context.Background(), userID, rbac.RoleViewer, &propertyID)
	require.NoError(t, err)

	hasRole, err := svc.CheckPermission(context.Background(), userID, rbac.RoleViewer, &propertyID)
	require.NoError(t, err)
	assert.False(t, hasRole)
}

func TestService_GetUserRoles(t *testing.T) {
	svc := newTestService(t)
	userID := uuid.New()
	prop1 := uuid.New()
	prop2 := uuid.New()

	_ = svc.AssignRole(context.Background(), userID, rbac.RoleOwner, &prop1)
	_ = svc.AssignRole(context.Background(), userID, rbac.RoleViewer, &prop2)

	roles, err := svc.GetUserRoles(context.Background(), userID)
	require.NoError(t, err)
	assert.Len(t, roles, 2)
}
package tenant_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockTenantRepo implements tenant.Repository in memory.
type mockTenantRepo struct {
	tenants map[uuid.UUID]*tenant.Tenant
}

func newMockTenantRepo() *mockTenantRepo {
	return &mockTenantRepo{tenants: map[uuid.UUID]*tenant.Tenant{}}
}

func (m *mockTenantRepo) Create(_ context.Context, ownerID uuid.UUID, in tenant.CreateTenantInput) (*tenant.Tenant, error) {
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	t := &tenant.Tenant{
		ID:         uuid.New(),
		OwnerID:    ownerID,
		Name:       in.Name,
		Email:      in.Email,
		Phone:      in.Phone,
		Document:   in.Document,
		PersonType: pt,
		IsActive:   true,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
	m.tenants[t.ID] = t
	return t, nil
}

func (m *mockTenantRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*tenant.Tenant, error) {
	t, ok := m.tenants[id]
	if !ok || t.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return t, nil
}

func (m *mockTenantRepo) List(_ context.Context, ownerID uuid.UUID) ([]tenant.Tenant, error) {
	var list []tenant.Tenant
	for _, t := range m.tenants {
		if t.OwnerID == ownerID && t.IsActive {
			list = append(list, *t)
		}
	}
	return list, nil
}

func (m *mockTenantRepo) Update(_ context.Context, id, ownerID uuid.UUID, in tenant.CreateTenantInput) (*tenant.Tenant, error) {
	t, ok := m.tenants[id]
	if !ok || t.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	pt := t.PersonType
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	t.Name = in.Name
	t.Email = in.Email
	t.Phone = in.Phone
	t.Document = in.Document
	t.PersonType = pt
	t.UpdatedAt = time.Now()
	return t, nil
}

func (m *mockTenantRepo) Delete(_ context.Context, id, ownerID uuid.UUID) error {
	t, ok := m.tenants[id]
	if !ok || t.OwnerID != ownerID {
		return errors.New("not found")
	}
	t.IsActive = false
	return nil
}

// --- Tests ---

func TestService_Create_PersonTypeObrigatório(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	_, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name: "Foo",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "person_type")
}

func TestService_Create_PersonTypeInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	invalid := "XX"
	_, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name:       "Foo",
		PersonType: &invalid,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "person_type")
}

func TestService_Create_PersonTypePF(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	pf := "PF"
	out, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name:       "Foo",
		PersonType: &pf,
	})
	require.NoError(t, err)
	assert.Equal(t, "PF", out.PersonType)
}

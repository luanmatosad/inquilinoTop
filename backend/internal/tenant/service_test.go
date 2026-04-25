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

func TestService_Create_NameObrigatório(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	pf := "PF"
	_, err := svc.Create(context.Background(), uuid.New(), tenant.CreateTenantInput{
		Name:       "",
		PersonType: &pf,
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "name")
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	ownerID := uuid.New()
	pf := "PF"

	t1, _ := svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name:       "Foo",
		PersonType: &pf,
	})
	found, err := svc.Get(context.Background(), t1.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, t1.ID, found.ID)
}

func TestService_Get_NãoEncontrado(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())
	require.Error(t, err)
}

func TestService_List(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	ownerID := uuid.New()
	pf := "PF"

	svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "A", PersonType: &pf})
	svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "B", PersonType: &pf})

	list, err := svc.List(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	ownerID := uuid.New()
	pf := "PF"

	t1, _ := svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "Foo", PersonType: &pf})
	updated, err := svc.Update(context.Background(), t1.ID, ownerID, tenant.CreateTenantInput{Name: "Bar", PersonType: &pf})
	require.NoError(t, err)
	assert.Equal(t, "Bar", updated.Name)
}

func TestService_Update_NãoEncontrado(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	pf := "PF"
	_, err := svc.Update(context.Background(), uuid.New(), uuid.New(), tenant.CreateTenantInput{Name: "Bar", PersonType: &pf})
	require.Error(t, err)
}

func TestService_Delete(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	ownerID := uuid.New()
	pf := "PF"

	t1, _ := svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "Foo", PersonType: &pf})
	err := svc.Delete(context.Background(), t1.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.List(context.Background(), ownerID)
	assert.Len(t, list, 0)
}

func TestService_Delete_NãoEncontrado(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	err := svc.Delete(context.Background(), uuid.New(), uuid.New())
	require.Error(t, err)
}

package property_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	properties     map[uuid.UUID]*property.Property
	units          map[uuid.UUID]*property.Unit
	unitOwners     map[uuid.UUID]uuid.UUID
	failCreateUnit bool
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		properties: make(map[uuid.UUID]*property.Property),
		units:      make(map[uuid.UUID]*property.Unit),
		unitOwners: make(map[uuid.UUID]uuid.UUID),
	}
}

func (m *mockRepo) Create(_ context.Context, ownerID uuid.UUID, in property.CreatePropertyInput) (*property.Property, error) {
	p := &property.Property{ID: uuid.New(), OwnerID: ownerID, Type: in.Type, Name: in.Name, IsActive: true}
	m.properties[p.ID] = p
	return p, nil
}

func (m *mockRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*property.Property, error) {
	p, ok := m.properties[id]
	if !ok || p.OwnerID != ownerID || !p.IsActive {
		return nil, errors.New("not found")
	}
	return p, nil
}

func (m *mockRepo) List(_ context.Context, ownerID uuid.UUID) ([]property.Property, error) {
	var list []property.Property
	for _, p := range m.properties {
		if p.OwnerID == ownerID && p.IsActive {
			list = append(list, *p)
		}
	}
	return list, nil
}

func (m *mockRepo) Update(_ context.Context, id, ownerID uuid.UUID, in property.CreatePropertyInput) (*property.Property, error) {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	p.Name = in.Name
	return p, nil
}

func (m *mockRepo) Delete(_ context.Context, id, ownerID uuid.UUID) error {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return err
	}
	p.IsActive = false
	return nil
}

func (m *mockRepo) CreateUnit(_ context.Context, propertyID uuid.UUID, in property.CreateUnitInput) (*property.Unit, error) {
	if m.failCreateUnit {
		return nil, errors.New("db error")
	}
	u := &property.Unit{ID: uuid.New(), PropertyID: propertyID, Label: in.Label, IsActive: true}
	m.units[u.ID] = u
	return u, nil
}

func (m *mockRepo) GetUnit(_ context.Context, id, ownerID uuid.UUID) (*property.Unit, error) {
	u, ok := m.units[id]
	if !ok || !u.IsActive {
		return nil, apierr.ErrNotFound
	}
	if propOwner, exists := m.unitOwners[id]; exists && propOwner != ownerID {
		return nil, apierr.ErrNotFound
	}
	return u, nil
}

func (m *mockRepo) ListUnits(_ context.Context, propertyID uuid.UUID) ([]property.Unit, error) {
	var list []property.Unit
	for _, u := range m.units {
		if u.PropertyID == propertyID && u.IsActive {
			list = append(list, *u)
		}
	}
	return list, nil
}

func (m *mockRepo) UpdateUnit(_ context.Context, id, ownerID uuid.UUID, in property.CreateUnitInput) (*property.Unit, error) {
	u, err := m.GetUnit(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	u.Label = in.Label
	return u, nil
}

func (m *mockRepo) DeleteUnit(_ context.Context, id, ownerID uuid.UUID) error {
	_, err := m.GetUnit(context.Background(), id, ownerID)
	if err != nil {
		return err
	}
	delete(m.units, id)
	return nil
}

func (m *mockRepo) ListUnitsByPropertyIDs(_ context.Context, propertyIDs []uuid.UUID) ([]property.Unit, error) {
	var list []property.Unit
	for _, u := range m.units {
		for _, pid := range propertyIDs {
			if u.PropertyID == pid && u.IsActive {
				list = append(list, *u)
				break
			}
		}
	}
	return list, nil
}

func TestService_CreateSingleProperty_AutoCreatesUnit(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, err := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "SINGLE", Name: "Casa"})
	require.NoError(t, err)

	units, _ := svc.ListUnits(context.Background(), p.ID)
	assert.Len(t, units, 1)
	assert.Equal(t, "Unidade 01", units[0].Label)
}

func TestService_CreateProperty_InvalidType(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.CreateProperty(context.Background(), uuid.New(), property.CreatePropertyInput{Type: "INVALID", Name: "X"})
	assert.Error(t, err)
}

func TestService_DeleteProperty(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	err := svc.DeleteProperty(context.Background(), p.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.ListProperties(context.Background(), ownerID)
	assert.Len(t, list, 0)
}

func TestService_GetProperty_Encontrado(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa"})
	found, err := svc.GetProperty(context.Background(), p.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, p.ID, found.ID)
}

func TestService_GetProperty_NãoEncontrado(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.GetProperty(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_UpdateProperty(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Antigo"})
	updated, err := svc.UpdateProperty(context.Background(), p.ID, ownerID, property.CreatePropertyInput{Name: "Novo"})
	require.NoError(t, err)
	assert.Equal(t, "Novo", updated.Name)
}

func TestService_CreateUnit_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, err := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 101"})
	require.NoError(t, err)
	assert.Equal(t, "Apto 101", u.Label)
	assert.Equal(t, p.ID, u.PropertyID)
}

func TestService_CreateUnit_ImóvelSemPermissão(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()
	outroOwner := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	_, err := svc.CreateUnit(context.Background(), p.ID, outroOwner, property.CreateUnitInput{Label: "Apto 101"})
	assert.Error(t, err)
}

func TestService_GetUnit_Encontrado(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 201"})

	found, err := svc.GetUnit(context.Background(), u.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, u.ID, found.ID)
}

func TestService_GetUnit_NãoEncontrado(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.GetUnit(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_ListUnits(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "A"})
	svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "B"})

	list, err := svc.ListUnits(context.Background(), p.ID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_UpdateUnit(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Original"})

	updated, err := svc.UpdateUnit(context.Background(), u.ID, ownerID, property.CreateUnitInput{Label: "Atualizado"})
	require.NoError(t, err)
	assert.Equal(t, "Atualizado", updated.Label)
}

func TestService_DeleteUnit(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Para deletar"})

	err := svc.DeleteUnit(context.Background(), u.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.ListUnits(context.Background(), p.ID)
	assert.Len(t, list, 0)
}

func TestService_CreateProperty_NomeVazio(t *testing.T) {
	svc := property.NewService(newMockRepo())
	_, err := svc.CreateProperty(context.Background(), uuid.New(), property.CreatePropertyInput{
		Name: "", Type: "RESIDENTIAL",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nome")
}

func TestService_ListProperties(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa 1"})
	svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa 2"})

	list, err := svc.ListProperties(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_ListPropertiesWithUnits(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 101"})

	result, err := svc.ListPropertiesWithUnits(context.Background(), ownerID)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Len(t, result[0].Units, 1)
}

func TestService_ListPropertiesWithUnits_Vazio(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)

	result, err := svc.ListPropertiesWithUnits(context.Background(), uuid.New())
	require.NoError(t, err)
	assert.Nil(t, result)
}

func TestService_CreateProperty_SingleUnitCreationError_ReturnsError(t *testing.T) {
	repo := newMockRepo()
	repo.failCreateUnit = true
	svc := property.NewService(repo)

	_, err := svc.CreateProperty(context.Background(), uuid.New(), property.CreatePropertyInput{
		Type: "SINGLE",
		Name: "Casa Teste",
	})

	assert.Error(t, err, "deve retornar erro quando criação da unit automática falha")
}

package property

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateProperty(ctx context.Context, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("property.svc: nome é obrigatório")
	}
	if in.Type != "RESIDENTIAL" && in.Type != "SINGLE" {
		return nil, fmt.Errorf("property.svc: tipo inválido")
	}
	p, err := s.repo.Create(ctx, ownerID, in)
	if err != nil {
		return nil, err
	}
	if in.Type == "SINGLE" {
		notes := "Unidade criada automaticamente"
		if _, err := s.repo.CreateUnit(ctx, p.ID, CreateUnitInput{Label: "Unidade 01", Notes: &notes}); err != nil {
			return nil, fmt.Errorf("property.svc: criar unit automática: %w", err)
		}
	}
	return p, nil
}

func (s *Service) GetProperty(ctx context.Context, id, ownerID uuid.UUID) (*Property, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) ListProperties(ctx context.Context, ownerID uuid.UUID) ([]Property, error) {
	return s.repo.List(ctx, ownerID)
}

func (s *Service) ListPropertiesWithUnits(ctx context.Context, ownerID uuid.UUID) ([]PropertyWithUnits, error) {
	properties, err := s.repo.List(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if len(properties) == 0 {
		return nil, nil
	}

	propertyIDs := make([]uuid.UUID, len(properties))
	for i, p := range properties {
		propertyIDs[i] = p.ID
	}

	allUnits, err := s.repo.ListUnitsByPropertyIDs(ctx, propertyIDs)
	if err != nil {
		return nil, err
	}

	unitsByProperty := make(map[uuid.UUID][]Unit)
	for _, u := range allUnits {
		unitsByProperty[u.PropertyID] = append(unitsByProperty[u.PropertyID], u)
	}

	result := make([]PropertyWithUnits, len(properties))
	for i, p := range properties {
		units := unitsByProperty[p.ID]
		if units == nil {
			units = []Unit{}
		}
		result[i] = PropertyWithUnits{
			Property: p,
			Units:    units,
		}
	}
	return result, nil
}

func (s *Service) UpdateProperty(ctx context.Context, id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	return s.repo.Update(ctx, id, ownerID, in)
}

func (s *Service) DeleteProperty(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.Delete(ctx, id, ownerID)
}

func (s *Service) CreateUnit(ctx context.Context, propertyID uuid.UUID, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	if _, err := s.repo.GetByID(ctx, propertyID, ownerID); err != nil {
		return nil, fmt.Errorf("property.svc: imóvel não encontrado ou sem permissão")
	}
	return s.repo.CreateUnit(ctx, propertyID, in)
}

func (s *Service) GetUnit(ctx context.Context, id, ownerID uuid.UUID) (*Unit, error) {
	return s.repo.GetUnit(ctx, id, ownerID)
}

func (s *Service) ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error) {
	return s.repo.ListUnits(ctx, propertyID)
}

func (s *Service) UpdateUnit(ctx context.Context, id, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	return s.repo.UpdateUnit(ctx, id, ownerID, in)
}

func (s *Service) DeleteUnit(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.DeleteUnit(ctx, id, ownerID)
}

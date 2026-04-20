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
		s.repo.CreateUnit(ctx, p.ID, CreateUnitInput{Label: "Unidade 01", Notes: &notes})
	}
	return p, nil
}

func (s *Service) GetProperty(ctx context.Context, id, ownerID uuid.UUID) (*Property, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) ListProperties(ctx context.Context, ownerID uuid.UUID) ([]Property, error) {
	return s.repo.List(ctx, ownerID)
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

func (s *Service) GetUnit(ctx context.Context, id uuid.UUID) (*Unit, error) {
	return s.repo.GetUnit(ctx, id)
}

func (s *Service) ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error) {
	return s.repo.ListUnits(ctx, propertyID)
}

func (s *Service) UpdateUnit(ctx context.Context, id uuid.UUID, in CreateUnitInput) (*Unit, error) {
	return s.repo.UpdateUnit(ctx, id, in)
}

func (s *Service) DeleteUnit(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteUnit(ctx, id)
}

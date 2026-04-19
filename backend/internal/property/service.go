package property

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateProperty(ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("property.svc: nome é obrigatório")
	}
	if in.Type != "RESIDENTIAL" && in.Type != "SINGLE" {
		return nil, fmt.Errorf("property.svc: tipo inválido")
	}
	p, err := s.repo.Create(ownerID, in)
	if err != nil {
		return nil, err
	}
	if in.Type == "SINGLE" {
		notes := "Unidade criada automaticamente"
		s.repo.CreateUnit(p.ID, CreateUnitInput{Label: "Unidade 01", Notes: &notes})
	}
	return p, nil
}

func (s *Service) GetProperty(id, ownerID uuid.UUID) (*Property, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) ListProperties(ownerID uuid.UUID) ([]Property, error) {
	return s.repo.List(ownerID)
}

func (s *Service) UpdateProperty(id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) DeleteProperty(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}

func (s *Service) CreateUnit(propertyID uuid.UUID, ownerID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	if _, err := s.repo.GetByID(propertyID, ownerID); err != nil {
		return nil, fmt.Errorf("property.svc: imóvel não encontrado ou sem permissão")
	}
	return s.repo.CreateUnit(propertyID, in)
}

func (s *Service) GetUnit(id uuid.UUID) (*Unit, error) {
	return s.repo.GetUnit(id)
}

func (s *Service) ListUnits(propertyID uuid.UUID) ([]Unit, error) {
	return s.repo.ListUnits(propertyID)
}

func (s *Service) UpdateUnit(id uuid.UUID, in CreateUnitInput) (*Unit, error) {
	return s.repo.UpdateUnit(id, in)
}

func (s *Service) DeleteUnit(id uuid.UUID) error {
	return s.repo.DeleteUnit(id)
}

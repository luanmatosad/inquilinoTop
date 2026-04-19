package tenant

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

func (s *Service) Create(ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if in.Name == "" {
		return nil, fmt.Errorf("tenant.svc: nome é obrigatório")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Tenant, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) List(ownerID uuid.UUID) ([]Tenant, error) {
	return s.repo.List(ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) Delete(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}

package lease

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

func (s *Service) Create(ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	if in.UnitID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: unit_id é obrigatório")
	}
	if in.TenantID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: tenant_id é obrigatório")
	}
	if in.RentAmount <= 0 {
		return nil, fmt.Errorf("lease.svc: rent_amount deve ser positivo")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Lease, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) List(ownerID uuid.UUID) ([]Lease, error) {
	return s.repo.List(ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	if in.Status != "ACTIVE" && in.Status != "ENDED" && in.Status != "CANCELED" {
		return nil, fmt.Errorf("lease.svc: status inválido")
	}
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) Delete(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}

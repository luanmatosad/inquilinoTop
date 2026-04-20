package lease

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

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	if in.UnitID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: unit_id é obrigatório")
	}
	if in.TenantID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: tenant_id é obrigatório")
	}
	if in.RentAmount <= 0 {
		return nil, fmt.Errorf("lease.svc: rent_amount deve ser positivo")
	}
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) Get(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) List(ctx context.Context, ownerID uuid.UUID) ([]Lease, error) {
	return s.repo.List(ctx, ownerID)
}

func (s *Service) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	if in.Status != "ACTIVE" && in.Status != "ENDED" && in.Status != "CANCELED" {
		return nil, fmt.Errorf("lease.svc: status inválido")
	}
	return s.repo.Update(ctx, id, ownerID, in)
}

func (s *Service) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.Delete(ctx, id, ownerID)
}

func (s *Service) End(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	return s.repo.End(ctx, id, ownerID)
}

func (s *Service) Renew(ctx context.Context, id, ownerID uuid.UUID, in RenewLeaseInput) (*Lease, error) {
	if in.NewEndDate.IsZero() {
		return nil, fmt.Errorf("lease.svc: new_end_date é obrigatório")
	}
	return s.repo.Renew(ctx, id, ownerID, in)
}

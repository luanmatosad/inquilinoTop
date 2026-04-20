package tenant

import (
	"context"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) Get(ctx context.Context, id, ownerID uuid.UUID) (*Tenant, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) List(ctx context.Context, ownerID uuid.UUID) ([]Tenant, error) {
	return s.repo.List(ctx, ownerID)
}

func (s *Service) Update(ctx context.Context, id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	return s.repo.Update(ctx, id, ownerID, in)
}

func (s *Service) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.Delete(ctx, id, ownerID)
}

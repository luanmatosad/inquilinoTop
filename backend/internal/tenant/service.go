package tenant

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

func (s *Service) Create(ctx context.Context, userID, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if in.PersonType == nil {
		return nil, fmt.Errorf("tenant.svc: person_type é obrigatório")
	}
	if *in.PersonType != "PF" && *in.PersonType != "PJ" {
		return nil, fmt.Errorf("tenant.svc: person_type inválido")
	}
	if in.Name == "" {
		return nil, fmt.Errorf("tenant.svc: nome é obrigatório")
	}
	return s.repo.Create(ctx, userID, orgID, in)
}

func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Tenant, error) {
	return s.repo.GetByID(ctx, id, orgID)
}

func (s *Service) List(ctx context.Context, orgID uuid.UUID) ([]Tenant, error) {
	return s.repo.List(ctx, orgID)
}

func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if in.PersonType == nil {
		return nil, fmt.Errorf("tenant.svc: person_type é obrigatório")
	}
	if *in.PersonType != "PF" && *in.PersonType != "PJ" {
		return nil, fmt.Errorf("tenant.svc: person_type inválido")
	}
	return s.repo.Update(ctx, id, orgID, in)
}

func (s *Service) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	return s.repo.Delete(ctx, id, orgID)
}

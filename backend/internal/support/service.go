package support

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

func (s *Service) Create(ctx context.Context, orgID, userID uuid.UUID, in CreateTicketInput) (*Ticket, error) {
	return s.repo.Create(ctx, orgID, userID, in)
}

func (s *Service) Get(ctx context.Context, id, orgID, userID uuid.UUID) (*Ticket, error) {
	return s.repo.GetByID(ctx, id, orgID, userID)
}

func (s *Service) ListByUser(ctx context.Context, orgID, userID uuid.UUID) ([]Ticket, error) {
	return s.repo.ListByUser(ctx, orgID, userID)
}
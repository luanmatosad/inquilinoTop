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

func (s *Service) Create(ctx context.Context, userID uuid.UUID, in CreateTicketInput) (*Ticket, error) {
	return s.repo.Create(ctx, userID, in)
}

func (s *Service) Get(ctx context.Context, id, userID uuid.UUID) (*Ticket, error) {
	return s.repo.GetByID(ctx, id, userID)
}

func (s *Service) ListByUser(ctx context.Context, userID uuid.UUID) ([]Ticket, error) {
	return s.repo.ListByUser(ctx, userID)
}
package expense

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

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) Get(ctx context.Context, id, ownerID uuid.UUID) (*Expense, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) ListByUnit(ctx context.Context, unitID, ownerID uuid.UUID) ([]Expense, error) {
	return s.repo.ListByUnit(ctx, unitID, ownerID)
}

func (s *Service) Update(ctx context.Context, id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	return s.repo.Update(ctx, id, ownerID, in)
}

func (s *Service) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.Delete(ctx, id, ownerID)
}

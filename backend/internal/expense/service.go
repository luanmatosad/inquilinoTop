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

func (s *Service) Create(ctx context.Context, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	return s.repo.Create(ctx, orgID, in)
}

func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Expense, error) {
	return s.repo.GetByID(ctx, id, orgID)
}

func (s *Service) ListByUnit(ctx context.Context, unitID, orgID uuid.UUID) ([]Expense, error) {
	return s.repo.ListByUnit(ctx, unitID, orgID)
}

func (s *Service) ListByOwner(ctx context.Context, orgID uuid.UUID) ([]Expense, error) {
	return s.repo.ListByOwner(ctx, orgID)
}

func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	return s.repo.Update(ctx, id, orgID, in)
}

func (s *Service) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	return s.repo.Delete(ctx, id, orgID)
}

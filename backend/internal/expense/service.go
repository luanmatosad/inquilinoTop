package expense

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

func (s *Service) Create(ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	if in.Description == "" {
		return nil, fmt.Errorf("expense.svc: description é obrigatório")
	}
	if in.Amount <= 0 {
		return nil, fmt.Errorf("expense.svc: amount deve ser positivo")
	}
	validCategories := map[string]bool{
		"ELECTRICITY": true, "WATER": true, "CONDO": true,
		"TAX": true, "MAINTENANCE": true, "OTHER": true,
	}
	if !validCategories[in.Category] {
		return nil, fmt.Errorf("expense.svc: category inválida")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Expense, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) ListByUnit(unitID, ownerID uuid.UUID) ([]Expense, error) {
	return s.repo.ListByUnit(unitID, ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	return s.repo.Update(id, ownerID, in)
}

func (s *Service) Delete(id, ownerID uuid.UUID) error {
	return s.repo.Delete(id, ownerID)
}

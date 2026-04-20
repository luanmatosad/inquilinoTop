package expense

import (
	"time"

	"github.com/google/uuid"
)

type Expense struct {
	ID          uuid.UUID `json:"id"`
	OwnerID     uuid.UUID `json:"owner_id"`
	UnitID      uuid.UUID `json:"unit_id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	DueDate     time.Time `json:"due_date"`
	Category    string    `json:"category"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateExpenseInput struct {
	UnitID      uuid.UUID `json:"unit_id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	DueDate     time.Time `json:"due_date"`
	Category    string    `json:"category"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	GetByID(id, ownerID uuid.UUID) (*Expense, error)
	ListByUnit(unitID, ownerID uuid.UUID) ([]Expense, error)
	Update(id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	Delete(id, ownerID uuid.UUID) error
}

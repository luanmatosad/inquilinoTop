package expense

import (
	"context"
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
	Create(ctx context.Context, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Expense, error)
	ListByUnit(ctx context.Context, unitID, ownerID uuid.UUID) ([]Expense, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
}

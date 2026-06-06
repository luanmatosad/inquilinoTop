package expense

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Expense struct {
	ID               uuid.UUID `json:"id"`
	OrganizationID   uuid.UUID `json:"organization_id"`
	UnitID           uuid.UUID `json:"unit_id"`
	Description string    `json:"description"`
	Amount      float64   `json:"amount"`
	DueDate     time.Time `json:"due_date"`
	Category    string    `json:"category"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateExpenseInput struct {
	UnitID      uuid.UUID `json:"-"`
	Description string    `json:"description" validate:"required,max=500"`
	Amount      float64   `json:"amount" validate:"required,min=0"`
	DueDate     time.Time `json:"due_date" validate:"required"`
	Category    string    `json:"category" validate:"required,oneof=ELECTRICITY WATER CONDO TAX MAINTENANCE OTHER"`
}

type Repository interface {
	Create(ctx context.Context, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Expense, error)
	ListByUnit(ctx context.Context, unitID, orgID uuid.UUID) ([]Expense, error)
	ListByOwner(ctx context.Context, orgID uuid.UUID) ([]Expense, error)
	Update(ctx context.Context, id, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	Delete(ctx context.Context, id, orgID uuid.UUID) error
}

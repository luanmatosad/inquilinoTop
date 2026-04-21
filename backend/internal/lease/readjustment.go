package lease

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Readjustment struct {
	ID         uuid.UUID `json:"id"`
	LeaseID   uuid.UUID `json:"lease_id"`
	OwnerID   uuid.UUID `json:"owner_id"`
	AppliedAt time.Time `json:"applied_at"`
	OldAmount float64   `json:"old_amount"`
	NewAmount float64   `json:"new_amount"`
	Percentage float64 `json:"percentage"`
	IndexName *string   `json:"index_name,omitempty"`
	Notes     *string   `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ReadjustInput struct {
	Percentage float64   `json:"percentage"`
	IndexName  *string   `json:"index_name,omitempty"`
	AppliedAt  time.Time `json:"applied_at"`
	Notes      *string   `json:"notes,omitempty"`
}

type ReadjustmentRepository interface {
	Create(ctx context.Context, r *Readjustment) (*Readjustment, error)
	ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Readjustment, error)
}
package payment

import (
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID        uuid.UUID  `json:"id"`
	OwnerID   uuid.UUID  `json:"owner_id"`
	LeaseID   uuid.UUID  `json:"lease_id"`
	DueDate   time.Time  `json:"due_date"`
	PaidDate  *time.Time `json:"paid_date,omitempty"`
	Amount    float64    `json:"amount"`
	Status    string     `json:"status"`
	Type      string     `json:"type"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CreatePaymentInput struct {
	LeaseID uuid.UUID `json:"lease_id"`
	DueDate time.Time `json:"due_date"`
	Amount  float64   `json:"amount"`
	Type    string    `json:"type"`
}

type UpdatePaymentInput struct {
	PaidDate *time.Time `json:"paid_date,omitempty"`
	Status   string     `json:"status"`
	Amount   float64    `json:"amount"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	GetByID(id, ownerID uuid.UUID) (*Payment, error)
	ListByLease(leaseID, ownerID uuid.UUID) ([]Payment, error)
	Update(id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
}

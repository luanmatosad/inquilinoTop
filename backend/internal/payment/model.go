package payment

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID              uuid.UUID  `json:"id"`
	OwnerID         uuid.UUID  `json:"owner_id"`
	LeaseID         uuid.UUID  `json:"lease_id"`
	DueDate         time.Time  `json:"due_date"`
	PaidDate        *time.Time `json:"paid_date,omitempty"`
	GrossAmount     float64    `json:"gross_amount"`
	LateFeeAmount   float64    `json:"late_fee_amount"`
	InterestAmount  float64    `json:"interest_amount"`
	IRRFAmount      float64    `json:"irrf_amount"`
	NetAmount       *float64   `json:"net_amount,omitempty"`
	Competency      *string    `json:"competency,omitempty"`
	Description     *string    `json:"description,omitempty"`
	Status          string     `json:"status"`
	Type            string     `json:"type"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type CreatePaymentInput struct {
	LeaseID     uuid.UUID `json:"lease_id"`
	DueDate     time.Time `json:"due_date"`
	GrossAmount float64   `json:"gross_amount"`
	Type        string    `json:"type"`
	Competency  *string   `json:"competency,omitempty"`
	Description *string   `json:"description,omitempty"`
}

type UpdatePaymentInput struct {
	PaidDate    *time.Time `json:"paid_date,omitempty"`
	Status      string     `json:"status"`
	GrossAmount float64    `json:"gross_amount"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error)
	ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
	MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
		lateFee, interest, irrf, netAmount float64) (*Payment, error)
}
package payment

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/tenant"
)

type LeaseReader interface {
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*lease.Lease, error)
}

type TenantReader interface {
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*tenant.Tenant, error)
}

type IRRFCalculator interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}

type Payment struct {
	ID             uuid.UUID  `json:"id"`
	OwnerID        uuid.UUID  `json:"owner_id"`
	LeaseID        uuid.UUID  `json:"lease_id"`
	DueDate        time.Time  `json:"due_date"`
	PaidDate       *time.Time `json:"paid_date,omitempty"`
	GrossAmount    float64    `json:"gross_amount"`
	LateFeeAmount  float64    `json:"late_fee_amount"`
	InterestAmount float64    `json:"interest_amount"`
	IRRFAmount     float64    `json:"irrf_amount"`
	NetAmount      *float64   `json:"net_amount,omitempty"`
	Competency     *string    `json:"competency,omitempty"`
	Description    *string    `json:"description,omitempty"`
	Status         string     `json:"status"`
	Type           string     `json:"type"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
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

type OwnerReader interface {
	GetByID(ctx context.Context, id uuid.UUID) (*OwnerSummary, error)
}

type OwnerSummary struct {
	ID       uuid.UUID
	Name     string
	Document *string
}

type UnitReader interface {
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*UnitSummary, error)
}

type UnitSummary struct {
	ID              uuid.UUID
	Label           *string
	PropertyAddress *string
}

type Receipt struct {
	PaymentID  uuid.UUID `json:"payment_id"`
	Competency *string   `json:"competency,omitempty"`
	IssuedAt   time.Time `json:"issued_at"`
	Owner      Party     `json:"owner"`
	Tenant     Party     `json:"tenant"`
	Unit       UnitRef   `json:"unit"`
	Amounts    Amounts   `json:"amounts"`
	PaidDate   time.Time `json:"paid_date"`
	LegalNote  string    `json:"legal_note"`
}

type Party struct {
	Name       string  `json:"name"`
	Document   *string `json:"document,omitempty"`
	PersonType *string `json:"person_type,omitempty"`
}

type UnitRef struct {
	Label           *string `json:"label,omitempty"`
	PropertyAddress *string `json:"property_address,omitempty"`
}

type Amounts struct {
	Gross        float64 `json:"gross"`
	LateFee      float64 `json:"late_fee"`
	Interest     float64 `json:"interest"`
	IRRFWithheld float64 `json:"irrf_withheld"`
	NetPaid      float64 `json:"net_paid"`
}

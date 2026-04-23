package lease

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Lease struct {
	ID                   uuid.UUID  `json:"id"`
	OwnerID              uuid.UUID  `json:"owner_id"`
	UnitID               uuid.UUID  `json:"unit_id"`
	TenantID             uuid.UUID  `json:"tenant_id"`
	StartDate            time.Time  `json:"start_date"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	RentAmount           float64    `json:"rent_amount"`
	DepositAmount        *float64   `json:"deposit_amount,omitempty"`
	PaymentDay          int        `json:"payment_day"`
	Status               string     `json:"status"`
	IsActive             bool       `json:"is_active"`
	LateFeePercent       float64    `json:"late_fee_percent"`
	DailyInterestPercent float64    `json:"daily_interest_percent"`
	IPTUReimbursable     bool       `json:"iptu_reimbursable"`
	AnnualIPTUAmount     *float64   `json:"annual_iptu_amount,omitempty"`
	IPTUYear             *int       `json:"iptu_year,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type CreateLeaseInput struct {
	UnitID               uuid.UUID  `json:"unit_id" validate:"required"`
	TenantID             uuid.UUID  `json:"tenant_id" validate:"required"`
	StartDate            time.Time  `json:"start_date" validate:"required"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	RentAmount           float64    `json:"rent_amount" validate:"required,min=0"`
	DepositAmount        *float64   `json:"deposit_amount,omitempty" validate:"omitempty,min=0"`
	PaymentDay           int        `json:"payment_day" validate:"required,min=1,max=31"`
	LateFeePercent       float64    `json:"late_fee_percent,omitempty" validate:"omitempty,min=0,max=100"`
	DailyInterestPercent float64    `json:"daily_interest_percent,omitempty" validate:"omitempty,min=0,max=10"`
	IPTUReimbursable     bool       `json:"iptu_reimbursable,omitempty"`
	AnnualIPTUAmount     *float64   `json:"annual_iptu_amount,omitempty" validate:"omitempty,min=0"`
	IPTUYear             *int       `json:"iptu_year,omitempty" validate:"omitempty,min=2000,max=2100"`
}

type UpdateLeaseInput struct {
	EndDate              *time.Time `json:"end_date,omitempty"`
	RentAmount           float64    `json:"rent_amount" validate:"required,min=0"`
	DepositAmount        *float64   `json:"deposit_amount,omitempty" validate:"omitempty,min=0"`
	PaymentDay          *int       `json:"payment_day,omitempty" validate:"omitempty,min=1,max=31"`
	Status               string     `json:"status" validate:"required,oneof=ACTIVE ENDED CANCELED"`
	LateFeePercent       float64    `json:"late_fee_percent,omitempty" validate:"omitempty,min=0,max=100"`
	DailyInterestPercent float64    `json:"daily_interest_percent,omitempty" validate:"omitempty,min=0,max=10"`
	IPTUReimbursable     bool       `json:"iptu_reimbursable,omitempty"`
	AnnualIPTUAmount     *float64   `json:"annual_iptu_amount,omitempty" validate:"omitempty,min=0"`
	IPTUYear             *int       `json:"iptu_year,omitempty" validate:"omitempty,min=2000,max=2100"`
}

type RenewLeaseInput struct {
	NewEndDate time.Time `json:"new_end_date" validate:"required"`
	PaymentDay *int    `json:"payment_day,omitempty" validate:"omitempty,min=1,max=31"`
	RentAmount float64   `json:"rent_amount,omitempty" validate:"omitempty,min=0"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error)
	List(ctx context.Context, ownerID uuid.UUID) ([]Lease, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
	End(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error)
	Renew(ctx context.Context, id, ownerID uuid.UUID, in RenewLeaseInput) (*Lease, error)
	UpdateRentAmount(ctx context.Context, id, ownerID uuid.UUID, amount float64) (*Lease, error)
}

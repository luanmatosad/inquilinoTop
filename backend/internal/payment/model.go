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
	ID               uuid.UUID  `json:"id"`
	OwnerID          uuid.UUID  `json:"owner_id"`
	LeaseID          uuid.UUID  `json:"lease_id"`
	DueDate          time.Time  `json:"due_date"`
	PaidDate         *time.Time `json:"paid_date,omitempty"`
	GrossAmount     float64    `json:"gross_amount"`
	LateFeeAmount   float64    `json:"late_fee_amount"`
	InterestAmount float64    `json:"interest_amount"`
	IRRFAmount    float64    `json:"irrf_amount"`
	NetAmount      *float64   `json:"net_amount,omitempty"`
	Competency     *string   `json:"competency,omitempty"`
	Description    *string   `json:"description,omitempty"`
	Status         string    `json:"status"`
	Type           string    `json:"type"`
	ChargeID       *string   `json:"charge_id,omitempty"`
	ChargeMethod   *string   `json:"charge_method,omitempty"`
	ChargeQRCode   *string   `json:"charge_qrcode,omitempty"`
	ChargeLink    *string   `json:"charge_link,omitempty"`
	ChargeBarcode *string   `json:"charge_barcode,omitempty"`
	PayoutID      *string   `json:"payout_id,omitempty"`
	PayoutStatus *string   `json:"payout_status,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreatePaymentInput struct {
	LeaseID     uuid.UUID `json:"-"`
	DueDate     time.Time `json:"due_date" validate:"required"`
	GrossAmount float64   `json:"gross_amount" validate:"required,min=0"`
	Type        string    `json:"type" validate:"required,oneof=RENT DEPOSIT EXPENSE OTHER"`
	Competency  *string   `json:"competency,omitempty" validate:"omitempty,len=7"` // YYYY-MM
	Description *string   `json:"description,omitempty" validate:"omitempty,max=500"`
}

type UpdatePaymentInput struct {
	PaidDate    *time.Time `json:"paid_date,omitempty"`
	Status      string     `json:"status" validate:"required,oneof=PENDING PAID LATE"`
	GrossAmount float64    `json:"gross_amount" validate:"required,min=0"`
}

type UpdateChargeInfoInput struct {
	ChargeID     string `json:"charge_id" validate:"required"`
	ChargeMethod string `json:"charge_method" validate:"required,oneof=PIX BOLETO TED"`
	QRCode       string `json:"qr_code,omitempty" validate:"omitempty"`
	Link          string `json:"link,omitempty" validate:"omitempty,url"`
	BarCode       string `json:"bar_code,omitempty" validate:"omitempty,numeric"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error)
	GetByChargeID(ctx context.Context, chargeID string) (*Payment, error)
	ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
	MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
		lateFee, interest, irrf, netAmount float64) (*Payment, error)
	UpdateChargeInfo(ctx context.Context, id, ownerID uuid.UUID, in UpdateChargeInfoInput) error
	UpdatePayoutInfo(ctx context.Context, id, ownerID uuid.UUID, payoutID, status string) error
	GetActiveFinancialConfig(ctx context.Context, ownerID uuid.UUID) (*FinancialConfig, error)
	CreateFinancialConfig(ctx context.Context, ownerID uuid.UUID, in CreateFinancialConfigInput) (*FinancialConfig, error)
	DeleteFinancialConfig(ctx context.Context, id, ownerID uuid.UUID) error
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

type FinancialConfig struct {
	ID         uuid.UUID            `json:"id"`
	OwnerID    uuid.UUID           `json:"owner_id"`
	Provider  string              `json:"provider" validate:"required,oneof=ASAAS BRADESCO ITAU SICOOB MOCK"`
	Config    map[string]string   `json:"config,omitempty"`
	PixKey    *string             `json:"pix_key,omitempty" validate:"omitempty,max=100"`
	BankInfo  *BankInfo           `json:"bank_info,omitempty"`
	IsActive  bool                `json:"is_active"`
	CreatedAt time.Time           `json:"created_at"`
	UpdatedAt time.Time           `json:"updated_at"`
}

type BankInfo struct {
	BankCode    string `json:"bank_code" validate:"required,numeric,len=3"`
	Agency      string `json:"agency" validate:"required,max=10"`
	Account    string `json:"account" validate:"required,max=20"`
	AccountType string `json:"account_type" validate:"required,oneof=CC CP"`
	OwnerName  string `json:"owner_name" validate:"required,max=200"`
	Document   string `json:"document" validate:"required,max=20"`
}

type CreateFinancialConfigInput struct {
	Provider string              `json:"provider" validate:"required,oneof=ASAAS BRADESCO ITAU SICOOB MOCK"`
	Config   map[string]string  `json:"config" validate:"required"`
	PixKey   *string             `json:"pix_key,omitempty" validate:"omitempty,max=100"`
	BankInfo *BankInfo            `json:"bank_info,omitempty"`
}

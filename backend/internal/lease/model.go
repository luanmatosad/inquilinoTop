package lease

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/apierr"
)

var (
	ErrInvalidPercentage = errors.New("percentual inválido")
	ErrLeaseNotActive    = errors.New("contrato não ativo")
	// ErrInvalidDates indica end_date igual ou anterior a start_date, ou renovação para antes do fim atual (HTTP 422).
	ErrInvalidDates = errors.New("lease: data final deve ser posterior à data inicial")
	// ErrLeaseOverlap indica que a unidade já tem contrato ativo no período (HTTP 409).
	ErrLeaseOverlap = fmt.Errorf("lease: unidade já possui contrato ativo no período: %w", apierr.ErrConflict)
	// ErrUnitNotFound e ErrTenantNotFound: referência inexistente, inativa ou de outra organização (HTTP 404).
	ErrUnitNotFound   = fmt.Errorf("lease: unidade não encontrada: %w", apierr.ErrNotFound)
	ErrTenantNotFound = fmt.Errorf("lease: inquilino não encontrado: %w", apierr.ErrNotFound)
	// ErrStatusChange: o status só muda por encerrar ou renovar (HTTP 409).
	ErrStatusChange = fmt.Errorf("lease: o status só muda por encerrar ou renovar: %w", apierr.ErrConflict)
)

// MaxInitialPayments limita as cobranças geradas na criação do contrato.
const MaxInitialPayments = 12

type Lease struct {
	ID                   uuid.UUID  `json:"id"`
	OrganizationID       uuid.UUID  `json:"organization_id"`
	OwnerID              uuid.UUID  `json:"owner_id"`
	UnitID               uuid.UUID  `json:"unit_id"`
	TenantID             uuid.UUID  `json:"tenant_id"`
	StartDate            time.Time  `json:"start_date"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	RentAmount           float64    `json:"rent_amount"`
	DepositAmount        *float64   `json:"deposit_amount,omitempty"`
	PaymentDay           int        `json:"payment_day"`
	Status               string     `json:"status"`
	IsActive             bool       `json:"is_active"`
	LateFeePercent       float64    `json:"late_fee_percent"`
	DailyInterestPercent float64    `json:"daily_interest_percent"`
	IPTUReimbursable     bool       `json:"iptu_reimbursable"`
	AnnualIPTUAmount     *float64   `json:"annual_iptu_amount,omitempty"`
	IPTUYear             *int       `json:"iptu_year,omitempty"`
	Notes                *string    `json:"notes,omitempty"`
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
	Notes                *string    `json:"notes,omitempty" validate:"omitempty,max=2000"`
	// GeneratePayments gera as cobranças de aluguel do período (no máximo MaxInitialPayments meses).
	GeneratePayments bool `json:"generate_payments,omitempty"`
}

type UpdateLeaseInput struct {
	EndDate       *time.Time `json:"end_date,omitempty"`
	RentAmount    float64    `json:"rent_amount" validate:"required,min=0"`
	DepositAmount *float64   `json:"deposit_amount,omitempty" validate:"omitempty,min=0"`
	PaymentDay    *int       `json:"payment_day,omitempty" validate:"omitempty,min=1,max=31"`
	// Status é opcional e, se enviado, precisa ser igual ao atual: use encerrar/renovar para mudá-lo.
	Status               string   `json:"status,omitempty" validate:"omitempty,oneof=ACTIVE ENDED CANCELED"`
	Notes                *string  `json:"notes,omitempty" validate:"omitempty,max=2000"`
	LateFeePercent       float64  `json:"late_fee_percent,omitempty" validate:"omitempty,min=0,max=100"`
	DailyInterestPercent float64  `json:"daily_interest_percent,omitempty" validate:"omitempty,min=0,max=10"`
	IPTUReimbursable     bool     `json:"iptu_reimbursable,omitempty"`
	AnnualIPTUAmount     *float64 `json:"annual_iptu_amount,omitempty" validate:"omitempty,min=0"`
	IPTUYear             *int     `json:"iptu_year,omitempty" validate:"omitempty,min=2000,max=2100"`
}

type RenewLeaseInput struct {
	NewEndDate time.Time `json:"new_end_date" validate:"required"`
	PaymentDay *int      `json:"payment_day,omitempty" validate:"omitempty,min=1,max=31"`
	RentAmount float64   `json:"rent_amount,omitempty" validate:"omitempty,min=0"`
}

type Repository interface {
	Create(ctx context.Context, orgID, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Lease, error)
	List(ctx context.Context, orgID uuid.UUID) ([]Lease, error)
	Update(ctx context.Context, id, orgID uuid.UUID, in UpdateLeaseInput) (*Lease, error)
	Delete(ctx context.Context, id, orgID uuid.UUID) error
	End(ctx context.Context, id, orgID uuid.UUID) (*Lease, error)
	Renew(ctx context.Context, id, orgID uuid.UUID, in RenewLeaseInput) (*Lease, error)
	UpdateRentAmount(ctx context.Context, id, orgID uuid.UUID, amount float64) (*Lease, error)
	// HasOverlap informa se a unidade tem outro contrato ACTIVE cujo período intersecta [start, end]
	// (end nulo = aberto). exceptID exclui o próprio contrato em edição/renovação.
	HasOverlap(ctx context.Context, unitID, orgID uuid.UUID, start time.Time, end *time.Time, exceptID uuid.UUID) (bool, error)
}

// UnitReader e TenantReader validam existência na organização; property.Repository e tenant.Repository os satisfazem.
type UnitReader interface {
	GetUnit(ctx context.Context, id, orgID uuid.UUID) (*property.Unit, error)
}

type TenantReader interface {
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*tenant.Tenant, error)
}

// PaymentHooks liga o contrato às cobranças sem importar o pacote payment (que já importa lease).
type PaymentHooks interface {
	// GenerateRentMonth gera (idempotente) a cobrança de aluguel da competência "YYYY-MM".
	GenerateRentMonth(ctx context.Context, userID, leaseID, orgID uuid.UUID, month string) error
	// CancelFuturePending retira as cobranças PENDING com vencimento depois de after e sem cobrança emitida.
	// needsReview conta as futuras pendentes com cobrança emitida, que ficam para decisão manual.
	CancelFuturePending(ctx context.Context, leaseID, orgID uuid.UUID, after time.Time) (canceled, needsReview int, err error)
}

// CreateOutput é o contrato criado mais o resultado da geração de cobranças.
type CreateOutput struct {
	*Lease
	PaymentsGenerated int    `json:"payments_generated"`
	PaymentsError     string `json:"payments_error,omitempty"`
}

// EndOutput é o contrato encerrado mais o resultado do cancelamento das cobranças futuras.
type EndOutput struct {
	*Lease
	PaymentsCanceled   int    `json:"payments_canceled"`
	PaymentsNeedReview int    `json:"payments_need_review"`
	PaymentsError      string `json:"payments_error,omitempty"`
}

type IndexValue struct {
	ID             uuid.UUID `json:"id"`
	IndexType      string    `json:"index_type"`
	ReferenceMonth time.Time `json:"reference_month"`
	Value          float64   `json:"value"`
	Cumulative     float64   `json:"cumulative"`
	CreatedAt      time.Time `json:"created_at"`
}

type AdjustLeaseInput struct {
	IndexType string `json:"index_type" validate:"required"`
}

type IndexRepository interface {
	GetHistory(ctx context.Context, indexType string) ([]IndexValue, error)
	GetLatest(ctx context.Context, indexType string) (*IndexValue, error)
}

package expense

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

const (
	StatusPending = "PENDING"
	StatusPaid    = "PAID"
	// StatusLate nunca é gravado: o service o devolve para PENDING vencida.
	StatusLate = "LATE"
)

var (
	// ErrAlreadyPaid: baixa de despesa já PAID (HTTP 409).
	ErrAlreadyPaid = fmt.Errorf("expense: despesa já está paga: %w", apierr.ErrConflict)
	// ErrNotPaid: estorno de despesa que não está PAID (HTTP 409).
	ErrNotPaid = fmt.Errorf("expense: despesa não está paga: %w", apierr.ErrConflict)
	// ErrLocked: despesa PAID não aceita mudança de valor nem de vencimento (HTTP 409).
	ErrLocked = fmt.Errorf("expense: despesa paga não aceita alterar valor ou vencimento: %w", apierr.ErrConflict)
	// ErrInvalidFilter: status de filtro desconhecido (HTTP 400).
	ErrInvalidFilter = fmt.Errorf("expense: filtro inválido")
)

type Expense struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	UnitID         uuid.UUID `json:"unit_id"`
	Description    string    `json:"description"`
	Amount         float64   `json:"amount"`
	DueDate        time.Time `json:"due_date"`
	Category       string    `json:"category"`
	// Status é PENDING, PAID ou LATE (PENDING vencida, derivado na leitura).
	Status     string     `json:"status"`
	PaidDate   *time.Time `json:"paid_date,omitempty"`
	PaidAmount *float64   `json:"paid_amount,omitempty"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type CreateExpenseInput struct {
	UnitID      uuid.UUID `json:"-"`
	Description string    `json:"description" validate:"required,max=500"`
	Amount      float64   `json:"amount" validate:"required,min=0"`
	DueDate     time.Time `json:"due_date" validate:"required"`
	Category    string    `json:"category" validate:"required,oneof=ELECTRICITY WATER CONDO TAX MAINTENANCE OTHER"`
}

// PayExpenseInput baixa a despesa; PaidAmount omitido assume o valor da despesa.
type PayExpenseInput struct {
	PaidDate   time.Time `json:"paid_date" validate:"required"`
	PaidAmount *float64  `json:"paid_amount,omitempty" validate:"omitempty,gt=0"`
}

// ListFilter restringe a listagem e o resumo. Status: PENDING (a vencer), LATE (vencida) ou PAID.
// From/To filtram o vencimento, inclusive nas extremidades.
type ListFilter struct {
	Status string
	From   *time.Time
	To     *time.Time
	UnitID *uuid.UUID
}

// Bucket agrupa quantidade e valor total.
type Bucket struct {
	Count int     `json:"count"`
	Total float64 `json:"total"`
}

// Summary totaliza o período: a vencer, vencidas e pagas (valor efetivamente pago).
type Summary struct {
	ToPay   Bucket `json:"to_pay"`
	Overdue Bucket `json:"overdue"`
	Paid    Bucket `json:"paid"`
}

type Repository interface {
	Create(ctx context.Context, userID, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Expense, error)
	ListByUnit(ctx context.Context, unitID, orgID uuid.UUID) ([]Expense, error)
	// List devolve as despesas da organização com o filtro aplicado em SQL; today separa a vencer de vencida.
	List(ctx context.Context, orgID uuid.UUID, f ListFilter, today time.Time) ([]Expense, error)
	Update(ctx context.Context, id, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error)
	Delete(ctx context.Context, id, orgID uuid.UUID) error
	// MarkPaid baixa só despesa PENDING; devolve ErrAlreadyPaid se já estiver PAID.
	MarkPaid(ctx context.Context, id, orgID uuid.UUID, paidDate time.Time, paidAmount float64) (*Expense, error)
	// MarkUnpaid estorna só despesa PAID; devolve ErrNotPaid se estiver PENDING.
	MarkUnpaid(ctx context.Context, id, orgID uuid.UUID) (*Expense, error)
	Summary(ctx context.Context, orgID uuid.UUID, f ListFilter, today time.Time) (Summary, error)
}

// Auditor registra baixa e estorno; *audit.Service satisfaz esta interface.
type Auditor interface {
	LogUpdate(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID, userID uuid.UUID, ipAddress string)
}

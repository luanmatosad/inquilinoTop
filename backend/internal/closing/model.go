package closing

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidMonth  = errors.New("closing: mês inválido, use AAAA-MM")
	ErrMonthNotEnded = errors.New("closing: só é possível fechar meses já encerrados")
	ErrAlreadyClosed = errors.New("closing: mês já fechado")
	ErrNotClosed     = errors.New("closing: mês não está fechado")
	ErrInvalidReason = errors.New("closing: informe o motivo da reabertura")
)

const (
	StatusOpen   = "OPEN"
	StatusClosed = "CLOSED"

	EventClosed   = "CLOSED"
	EventReopened = "REOPENED"
)

// Bucket agrupa quantidade e valor bruto.
type Bucket struct {
	Count int     `json:"count"`
	Total float64 `json:"total"`
}

// Pending é uma cobrança do mês que ficou sem pagamento confirmado.
type Pending struct {
	PaymentID uuid.UUID `json:"payment_id"`
	Tenant    string    `json:"tenant"`
	Amount    float64   `json:"amount"`
	DueDate   string    `json:"due_date"`
	// Awaiting: o inquilino avisou que pagou e o dono ainda não confirmou.
	Awaiting bool `json:"awaiting"`
}

// Snapshot é o retrato do mês: gravado ao fechar, calculado na hora enquanto aberto.
type Snapshot struct {
	Forecast       Bucket    `json:"forecast"`
	Received       Bucket    `json:"received"`
	Overdue        Bucket    `json:"overdue"`
	ReceiptsIssued int       `json:"receipts_issued"`
	Pending        []Pending `json:"pending"`
}

// PaymentFact é o que o fechamento precisa saber de uma cobrança de aluguel do mês.
type PaymentFact struct {
	ID         uuid.UUID
	Tenant     string
	DueDate    time.Time
	Gross      float64
	Paid       bool
	Awaiting   bool
	HasReceipt bool
}

type Event struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"-"`
	Month          string     `json:"-"`
	ClosingID      uuid.UUID  `json:"-"`
	Kind           string     `json:"kind"`
	ActorID        *uuid.UUID `json:"actor_id,omitempty"`
	ActorName      string     `json:"actor_name"`
	Reason         *string    `json:"reason,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// Closing é o estado do mês: OPEN (retrato ao vivo) ou CLOSED (retrato gravado).
type Closing struct {
	ID             uuid.UUID  `json:"-"`
	OrganizationID uuid.UUID  `json:"-"`
	Month          string     `json:"month"`
	Status         string     `json:"status"`
	ClosedAt       *time.Time `json:"closed_at,omitempty"`
	ClosedBy       *uuid.UUID `json:"closed_by,omitempty"`
	ClosedByName   string     `json:"closed_by_name,omitempty"`
	Snapshot       Snapshot   `json:"snapshot"`
	Events         []Event    `json:"events"`
}

// PaymentSource lista as cobranças de aluguel com vencimento entre from e to (inclusive).
type PaymentSource interface {
	RentOfMonth(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]PaymentFact, error)
}

// NameReader devolve o nome de exibição do usuário (perfil ou e-mail).
type NameReader interface {
	Name(ctx context.Context, userID uuid.UUID) string
}

type Repository interface {
	// GetActive devolve o fechamento ativo do mês ou apierr.ErrNotFound.
	GetActive(ctx context.Context, orgID uuid.UUID, month string) (*Closing, error)
	// Close grava o fechamento e o evento CLOSED; ErrAlreadyClosed se já há um ativo.
	Close(ctx context.Context, c Closing, e Event) error
	// Reopen desativa o fechamento ativo e grava o evento REOPENED; ErrNotClosed se não há.
	Reopen(ctx context.Context, orgID uuid.UUID, month string, e Event) error
	Events(ctx context.Context, orgID uuid.UUID, month string) ([]Event, error)
}

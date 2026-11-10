package report

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrInvalidYear = errors.New("report: ano inválido")

// MonthAmount é o total de um mês (AAAA-MM) e quantos lançamentos o compõem.
type MonthAmount struct {
	Month string
	Total float64
	Count int
}

// UnitAmount é o total de uma unidade no período.
type UnitAmount struct {
	UnitID uuid.UUID
	Total  float64
}

type MonthRow struct {
	Month    string  `json:"month"`
	Received float64 `json:"received"`
	Expenses float64 `json:"expenses"`
}

type Totals struct {
	Received      float64 `json:"received"`
	Expenses      float64 `json:"expenses"`
	Result        float64 `json:"result"`
	PaymentsCount int     `json:"payments_count"`
}

type Overview struct {
	Year int `json:"year"`
	// ThroughMonth é o último mês completo incluído (0 = nenhum ainda).
	ThroughMonth int        `json:"through_month"`
	Months       []MonthRow `json:"months"`
	Totals       Totals     `json:"totals"`
}

type UnitRow struct {
	UnitID   uuid.UUID `json:"unit_id"`
	Received float64   `json:"received"`
	Expenses float64   `json:"expenses"`
	Result   float64   `json:"result"`
}

type ByProperty struct {
	Year         int       `json:"year"`
	ThroughMonth int       `json:"through_month"`
	Rows         []UnitRow `json:"rows"`
	Totals       Totals    `json:"totals"`
}

// Repository agrega por data de pagamento: aluguéis pagos (valor líquido) e despesas pagas.
type Repository interface {
	MonthlyReceived(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error)
	MonthlyExpenses(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error)
	UnitReceived(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error)
	UnitExpenses(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error)
}

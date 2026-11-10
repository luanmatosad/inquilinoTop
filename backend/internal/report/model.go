package report

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidYear   = errors.New("report: ano inválido")
	ErrInvalidMonth  = errors.New("report: mês inválido, use AAAA-MM")
	ErrMonthNotEnded = errors.New("report: o mês ainda não terminou")
)

// DeductibleCategories são as categorias de despesa que entram no carnê-leão (fixas até existir Configurações).
var DeductibleCategories = []string{"TAX", "CONDO"}

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

// IncomeLine é um aluguel pago no mês por inquilino pessoa física.
type IncomeLine struct {
	Payer    string    `json:"payer"`
	UnitID   uuid.UUID `json:"unit_id"`
	PaidDate string    `json:"paid_date"`
	Amount   float64   `json:"amount"`
}

// DeductionLine é uma despesa paga no mês que entra no carnê-leão.
type DeductionLine struct {
	Description string    `json:"description"`
	UnitID      uuid.UUID `json:"unit_id"`
	Category    string    `json:"category"`
	Amount      float64   `json:"amount"`
}

type IncomeSection struct {
	Total float64      `json:"total"`
	Count int          `json:"count"`
	Lines []IncomeLine `json:"lines"`
}

type DeductionSection struct {
	Total float64         `json:"total"`
	Count int             `json:"count"`
	Lines []DeductionLine `json:"lines"`
}

// CarneLeao é o relatório mensal para o contador. DueDate é o prazo estimado (AAAA-MM-DD).
type CarneLeao struct {
	Month      string           `json:"month"`
	DueDate    string           `json:"due_date"`
	Income     IncomeSection    `json:"income"`
	Deductions DeductionSection `json:"deductions"`
	// Base estimada: rendimentos menos despesas que entram, nunca abaixo de zero.
	Base float64 `json:"base"`
}

// Repository agrega por data de pagamento: aluguéis pagos (valor líquido) e despesas pagas.
type Repository interface {
	MonthlyReceived(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error)
	MonthlyExpenses(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error)
	UnitReceived(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error)
	UnitExpenses(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error)
	// CarneIncome lista os aluguéis pagos no período por inquilinos pessoa física (por data de pagamento).
	CarneIncome(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]IncomeLine, error)
	// CarneDeductions lista as despesas pagas no período nas categorias informadas.
	CarneDeductions(ctx context.Context, orgID uuid.UUID, from, to time.Time, categories []string) ([]DeductionLine, error)
}

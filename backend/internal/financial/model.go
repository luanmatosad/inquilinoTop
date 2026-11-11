package financial

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

const (
	StatusPending     = "PENDING"
	StatusProcessed   = "PROCESSED"
	StatusTransferred = "TRANSFERRED"

	TypeCredit = "CREDIT"
	TypeDebit  = "DEBIT"
)

var (
	// ErrInvalidPeriod: competência fora do formato YYYY-MM (HTTP 400).
	ErrInvalidPeriod = errors.New("financial: período inválido")
	// ErrInvalidTransition: mudança de status fora de PENDING→PROCESSED→TRANSFERRED (HTTP 409).
	ErrInvalidTransition = errors.New("financial: transição de status inválida")
	// ErrTransferLocked: descontos só mudam enquanto o repasse está PENDING (HTTP 409).
	ErrTransferLocked = errors.New("financial: repasse já processado")
	// ErrDiscountsExceedGross: descontos + taxa maiores que o bruto (HTTP 400).
	ErrDiscountsExceedGross = errors.New("financial: descontos maiores que o valor recebido")
	// ErrInvalidDiscounts: desconto negativo (HTTP 400).
	ErrInvalidDiscounts = errors.New("financial: desconto inválido")
	// ErrInvalidCSV: arquivo de extrato fora do formato esperado (HTTP 400).
	ErrInvalidCSV = errors.New("financial: csv inválido")
	// ErrConcurrentUpdate: o status mudou entre a leitura e a gravação (HTTP 409).
	ErrConcurrentUpdate = errors.New("financial: repasse alterado por outra requisição")
	// ErrInvalidAdminFee: taxa administrativa fora de 0–100 (HTTP 400).
	ErrInvalidAdminFee = errors.New("financial: taxa administrativa inválida")
)

// Transfer é o repasse de um imóvel na competência. Valores em reais, duas casas.
type Transfer struct {
	ID              uuid.UUID  `json:"id"`
	PropertyID      uuid.UUID  `json:"property_id"`
	PropertyName    string     `json:"property_name"`
	OwnerName       string     `json:"owner_name"`
	Period          string     `json:"period"`
	GrossAmount     float64    `json:"gross_amount"`
	AdminFeePercent float64    `json:"admin_fee_percent"`
	AdminFeeAmount  float64    `json:"admin_fee_amount"`
	Discounts       float64    `json:"discounts"`
	NetAmount       float64    `json:"net_amount"`
	Status          string     `json:"status"`
	TransferredAt   *time.Time `json:"transferred_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// TransferFilter: status vazio = todos; From/To em YYYY-MM (inclusive); PropertyID nil = todos.
type TransferFilter struct {
	Status     string
	From       string
	To         string
	PropertyID *uuid.UUID
}

// UpdateTransferInput: campos nil não mudam.
type UpdateTransferInput struct {
	Status    *string
	Discounts *float64
}

// PropertyGross é o total de aluguel pago de um imóvel na competência (base do repasse).
type PropertyGross struct {
	PropertyID uuid.UUID
	Gross      float64
}

// BankRecordInput é uma linha validada do extrato, antes de gravar.
type BankRecordInput struct {
	Date        time.Time
	Description string
	Amount      float64
	Type        string
}

// BankRecord é um lançamento importado. PaymentID nil = não conciliado.
type BankRecord struct {
	ID          uuid.UUID  `json:"id"`
	Date        time.Time  `json:"date"`
	Description string     `json:"description"`
	Amount      float64    `json:"amount"`
	Type        string     `json:"type"`
	PaymentID   *uuid.UUID `json:"payment_id,omitempty"`
}

// BankRecordFilter: From/To inclusivos (nil = sem limite).
type BankRecordFilter struct {
	From *time.Time
	To   *time.Time
}

// ImportResult resume a importação. Unmatched são os lançamentos novos sem pagamento correspondente.
type ImportResult struct {
	Imported  int          `json:"imported"`
	Duplicate int          `json:"duplicate"`
	Matched   int          `json:"matched"`
	Unmatched []BankRecord `json:"unmatched"`
}

// Repository é o acesso a dados do domínio. Toda operação recebe orgID e filtra por organization_id.
type Repository interface {
	AdminFeePercent(ctx context.Context, orgID uuid.UUID) (float64, error)
	SetAdminFeePercent(ctx context.Context, orgID uuid.UUID, pct float64) error
	PaidRentByProperty(ctx context.Context, orgID uuid.UUID, period string) ([]PropertyGross, error)
	InsertTransfers(ctx context.Context, orgID uuid.UUID, period string, rows []Transfer) (int, error)
	ListTransfers(ctx context.Context, orgID uuid.UUID, f TransferFilter) ([]Transfer, error)
	GetTransfer(ctx context.Context, id, orgID uuid.UUID) (*Transfer, error)
	// SaveTransfer grava o estado de t só se o status atual ainda for expectedStatus (ErrConcurrentUpdate senão).
	SaveTransfer(ctx context.Context, orgID uuid.UUID, t *Transfer, expectedStatus string) error

	// InsertBankRecord: se a linha já existia, devolve o id existente com inserted=false (reimportação).
	InsertBankRecord(ctx context.Context, orgID uuid.UUID, in BankRecordInput) (id uuid.UUID, inserted bool, err error)
	// MatchBankRecord vincula o lançamento a um pagamento PAID de ±1 dia e ±5% do valor; nil se não houver.
	MatchBankRecord(ctx context.Context, orgID, recordID uuid.UUID) (*uuid.UUID, error)
	ListBankRecords(ctx context.Context, orgID uuid.UUID, f BankRecordFilter) ([]BankRecord, error)
}

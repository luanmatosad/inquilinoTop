package payment

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/tenant"
)

var (
	// ErrInvalidFilter: status de filtro desconhecido (HTTP 400).
	ErrInvalidFilter  = errors.New("filtro inválido")
	ErrInvalidMonth   = errors.New("mês inválido")
	ErrLeaseNotActive = errors.New("contrato não ativo")
	ErrIPTUMissing    = errors.New("IPTU não configurado")
)

type LeaseReader interface {
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*lease.Lease, error)
}

type TenantReader interface {
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*tenant.Tenant, error)
}

type IRRFCalculator interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}

type Payment struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
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
	ChargeID       *string    `json:"charge_id,omitempty"`
	ChargeMethod   *string    `json:"charge_method,omitempty"`
	ChargeQRCode   *string    `json:"charge_qrcode,omitempty"`
	ChargeLink     *string    `json:"charge_link,omitempty"`
	ChargeBarcode  *string    `json:"charge_barcode,omitempty"`
	PayoutID       *string    `json:"payout_id,omitempty"`
	PayoutStatus   *string    `json:"payout_status,omitempty"`
	// Dados do pagamento manual, do acordo e do recibo (migration 000049).
	PaymentMethod   *string    `json:"payment_method,omitempty"`
	DiscountAmount  float64    `json:"discount_amount"`
	PaymentNote     *string    `json:"payment_note,omitempty"`
	OriginalDueDate *time.Time `json:"original_due_date,omitempty"`
	ReceiptNumber   *int       `json:"receipt_number,omitempty"`
	ReceiptYear     *int       `json:"receipt_year,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
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
	// Dados do pagamento manual; só valem ao marcar PAID (migration 000049).
	PaymentMethod  *string `json:"payment_method,omitempty" validate:"omitempty,oneof=PIX CASH TRANSFER BOLETO OTHER"`
	DiscountAmount float64 `json:"discount_amount,omitempty" validate:"min=0"`
	PaymentNote    *string `json:"payment_note,omitempty" validate:"omitempty,max=500"`
}

// AgreementInput é o acordo de atraso: nova data e valor combinado (padrão: total atualizado de hoje).
type AgreementInput struct {
	NewDueDate   time.Time `json:"new_due_date" validate:"required"`
	AgreedAmount *float64  `json:"agreed_amount,omitempty" validate:"omitempty,gt=0"`
	Note         *string   `json:"note,omitempty" validate:"omitempty,max=500"`
}

// AgreementApply é o que o repositório grava: novos valores e os anteriores (para o evento).
type AgreementApply struct {
	NewDueDate time.Time
	NewGross   float64
	OldDueDate time.Time
	OldGross   float64
	Note       *string
	ActorID    *uuid.UUID
}

// PaidInput reúne tudo o que a baixa grava: valores calculados, forma, desconto, observação e autor.
type PaidInput struct {
	PaidDate time.Time
	LateFee  float64
	Interest float64
	IRRF     float64
	Net      float64
	Discount float64
	Method   *string
	Note     *string
	ActorID  *uuid.UUID
}

type UpdateChargeInfoInput struct {
	ChargeID     string `json:"charge_id" validate:"required"`
	ChargeMethod string `json:"charge_method" validate:"required,oneof=PIX BOLETO TED"`
	QRCode       string `json:"qr_code,omitempty" validate:"omitempty"`
	Link         string `json:"link,omitempty" validate:"omitempty,url"`
	BarCode      string `json:"bar_code,omitempty" validate:"omitempty,numeric"`
}

// DeactivateResult resume o cancelamento das cobranças futuras de um contrato encerrado.
type DeactivateResult struct {
	// Deactivated é o número de cobranças pendentes futuras retiradas (is_active=false).
	Deactivated int `json:"deactivated"`
	// NeedsReview conta pendentes futuras com cobrança emitida (charge_id), mantidas para decisão manual.
	NeedsReview int `json:"needs_review"`
}

// RentUpdateResult resume a atualização do aluguel das cobranças futuras de um contrato reajustado.
type RentUpdateResult struct {
	// Updated é o número de cobranças RENT pendentes futuras que passaram ao novo valor.
	Updated int `json:"updated"`
	// NeedsReview conta pendentes futuras com cobrança emitida (charge_id), mantidas no valor antigo.
	NeedsReview int `json:"needs_review"`
}

// PaymentFilter restringe a listagem e o resumo. Status: PENDING (a vencer), LATE (vencida) ou PAID.
// From/To filtram o vencimento, inclusive nas extremidades.
type PaymentFilter struct {
	Status  string
	From    *time.Time
	To      *time.Time
	LeaseID *uuid.UUID
}

// Bucket agrupa quantidade e valor total.
type Bucket struct {
	Count int     `json:"count"`
	Total float64 `json:"total"`
}

// Summary totaliza o período: a receber (a vencer), vencidos (valor atualizado com multa e juros) e recebidos.
type Summary struct {
	ToReceive Bucket `json:"to_receive"`
	Overdue   Bucket `json:"overdue"`
	Paid      Bucket `json:"paid"`
}

// Tipos de evento gravados na linha do tempo da cobrança.
const (
	EventSent      = "SENT"
	EventReminder  = "REMINDER"
	EventAgreement = "AGREEMENT"
	EventPaid      = "PAID"
	// Marcos calculados, nunca gravados.
	TimelineCreated = "CREATED"
	TimelineOverdue = "OVERDUE"
)

// Event é um fato imutável da cobrança (envio, lembrete, acordo, pagamento).
type Event struct {
	ID         uuid.UUID      `json:"id"`
	PaymentID  uuid.UUID      `json:"payment_id"`
	Kind       string         `json:"kind"`
	Channel    *string        `json:"channel,omitempty"`
	Data       map[string]any `json:"data,omitempty"`
	ActorID    *uuid.UUID     `json:"actor_id,omitempty"`
	OccurredAt time.Time      `json:"occurred_at"`
}

// TimelineItem é uma linha da linha do tempo: um evento gravado ou um marco calculado (Synthetic).
type TimelineItem struct {
	Kind      string         `json:"kind"`
	At        time.Time      `json:"at"`
	Channel   *string        `json:"channel,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
	ActorID   *uuid.UUID     `json:"actor_id,omitempty"`
	Synthetic bool           `json:"synthetic"`
}

// RecordEventInput registra o envio da cobrança; só SENT e REMINDER podem ser criados pela API.
type RecordEventInput struct {
	Kind    string `json:"kind" validate:"required,oneof=SENT REMINDER"`
	Channel string `json:"channel" validate:"required,oneof=WHATSAPP EMAIL COPY"`
}

// EventStore guarda e lista os eventos da cobrança, sempre por organização.
type EventStore interface {
	AddEvent(ctx context.Context, orgID, paymentID uuid.UUID, actorID *uuid.UUID, kind string, channel *string, data map[string]any) (*Event, error)
	ListEvents(ctx context.Context, paymentID, orgID uuid.UUID) ([]Event, error)
}

type Repository interface {
	Create(ctx context.Context, userID, orgID uuid.UUID, in CreatePaymentInput) (*Payment, error)
	CreateIfAbsent(ctx context.Context, userID, orgID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Payment, error)
	GetByChargeID(ctx context.Context, chargeID string) (*Payment, error)
	ListByLease(ctx context.Context, leaseID, orgID uuid.UUID) ([]Payment, error)
	// List filtra em SQL por status, vencimento e contrato; today separa a vencer de vencida.
	List(ctx context.Context, orgID uuid.UUID, f PaymentFilter, today time.Time) ([]Payment, error)
	// DeactivateFuturePending retira (is_active=false) as cobranças PENDING com vencimento depois de after
	// e sem charge_id. É a única exceção à imutabilidade de payment (ADR payment-0003).
	DeactivateFuturePending(ctx context.Context, leaseID, orgID uuid.UUID, after time.Time) (DeactivateResult, error)
	// UpdateFuturePendingRent aplica o novo aluguel às cobranças RENT PENDING ativas, sem cobrança emitida,
	// com vencimento a partir de from (inclusive). É atualização, nunca remoção (ADR payment-0001).
	UpdateFuturePendingRent(ctx context.Context, leaseID, orgID uuid.UUID, from time.Time, amount float64) (RentUpdateResult, error)
	Update(ctx context.Context, id, orgID uuid.UUID, in UpdatePaymentInput) (*Payment, error)
	// MarkPaid baixa a cobrança numa transação: grava os valores, tira o número do recibo e registra o evento PAID.
	MarkPaid(ctx context.Context, id, orgID uuid.UUID, in PaidInput) (*Payment, error)
	// ApplyAgreement troca vencimento e valor de uma cobrança aberta sem cobrança emitida, preserva o vencimento
	// original e registra o evento AGREEMENT. É atualização, nunca remoção (ADR payment-0001).
	ApplyAgreement(ctx context.Context, id, orgID uuid.UUID, in AgreementApply) (*Payment, error)
	// EnsureReceiptNumber atribui o número do recibo a uma cobrança paga que ainda não o tem (pagas antes da numeração).
	EnsureReceiptNumber(ctx context.Context, id, orgID uuid.UUID) (*Payment, error)
	UpdateChargeInfo(ctx context.Context, id, orgID uuid.UUID, in UpdateChargeInfoInput) error
	UpdatePayoutInfo(ctx context.Context, id, orgID uuid.UUID, payoutID, status string) error
	GetActiveFinancialConfig(ctx context.Context, orgID uuid.UUID) (*FinancialConfig, error)
	GetFinancialConfig(ctx context.Context, orgID uuid.UUID) (*FinancialConfig, error)
	CreateFinancialConfig(ctx context.Context, orgID uuid.UUID, in CreateFinancialConfigInput) (*FinancialConfig, error)
	UpsertFinancialConfig(ctx context.Context, orgID uuid.UUID, in UpsertFinancialConfigInput) (*FinancialConfig, error)
	DeleteFinancialConfig(ctx context.Context, id, orgID uuid.UUID) error
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
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*UnitSummary, error)
}

type UnitSummary struct {
	ID              uuid.UUID
	Label           *string
	PropertyAddress *string
	PropertyCity    *string
}

// PixCode é o Pix copia-e-cola estático da cobrança, com o valor atualizado do dia.
type PixCode struct {
	Payload string  `json:"payload"`
	Amount  float64 `json:"amount"`
}

type Receipt struct {
	PaymentID uuid.UUID `json:"payment_id"`
	// Number é o número sequencial por organização e ano, no formato 0001/2026.
	Number        string    `json:"number"`
	PaymentMethod *string   `json:"payment_method,omitempty"`
	Note          *string   `json:"payment_note,omitempty"`
	Competency    *string   `json:"competency,omitempty"`
	IssuedAt      time.Time `json:"issued_at"`
	Owner         Party     `json:"owner"`
	Tenant        Party     `json:"tenant"`
	Unit          UnitRef   `json:"unit"`
	Amounts       Amounts   `json:"amounts"`
	PaidDate      time.Time `json:"paid_date"`
	LegalNote     string    `json:"legal_note"`
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
	Discount     float64 `json:"discount"`
	IRRFWithheld float64 `json:"irrf_withheld"`
	NetPaid      float64 `json:"net_paid"`
}

type FinancialConfig struct {
	ID             uuid.UUID      `json:"id"`
	OrganizationID uuid.UUID      `json:"organization_id"`
	Provider       string         `json:"provider" validate:"required,oneof=ASAAS BRADESCO ITAU SICOOB MOCK"`
	Config         map[string]any `json:"config,omitempty"`
	PixKey         *string        `json:"pix_key,omitempty" validate:"omitempty,max=100"`
	BankInfo       *BankInfo      `json:"bank_info,omitempty"`
	IsActive       bool           `json:"is_active"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

type BankInfo struct {
	BankCode    string `json:"bank_code" validate:"required,numeric,len=3"`
	Agency      string `json:"agency" validate:"required,max=10"`
	Account     string `json:"account" validate:"required,max=20"`
	AccountType string `json:"account_type" validate:"required,oneof=CC CP"`
	OwnerName   string `json:"owner_name" validate:"required,max=200"`
	Document    string `json:"document" validate:"required,max=20"`
}

type CreateFinancialConfigInput struct {
	Provider string         `json:"provider" validate:"required,oneof=ASAAS BRADESCO ITAU SICOOB MOCK"`
	Config   map[string]any `json:"config" validate:"required"`
	PixKey   *string        `json:"pix_key,omitempty" validate:"omitempty,max=100"`
	BankInfo *BankInfo      `json:"bank_info,omitempty"`
}

type UpsertFinancialConfigInput struct {
	Provider string         `json:"provider" validate:"required,oneof=ASAAS BRADESCO ITAU SICOOB MOCK"`
	Config   map[string]any `json:"config" validate:"required"`
	PixKey   *string        `json:"pix_key,omitempty" validate:"omitempty,max=100"`
	BankInfo *BankInfo      `json:"bank_info,omitempty"`
}

package provider

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type ChargeMethod string

const (
	ChargeMethodPIX    ChargeMethod = "PIX"
	ChargeMethodBOLETO ChargeMethod = "BOLETO"
)

type PaymentProvider interface {
	CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error)
	CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error)
	GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error)
	CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error)
	RegisterWebhook(ctx context.Context, url string, events []string) error
	GetProviderName() string
}

type ChargeRequest struct {
	Amount       float64
	Currency    string
	DueDate     *time.Time
	Customer    Customer
	Reference  string
	Description string
}

type Customer struct {
	Name     string
	Document string
	Email    string
}

type ChargeResponse struct {
	ChargeID      string
	Status       string
	QRCode       string
	QRLink       string
	BarCode      string
	PixCopiaCola string
	ExpiresAt   *time.Time
	PaidAt      *time.Time
}

type ChargeStatus struct {
	ChargeID string
	Status  string
	PaidAt  *time.Time
	Amount  float64
}

type PayoutRequest struct {
	Amount        float64
	Currency     string
	Destination  Destination
	Reference   string
	ScheduleDate *time.Time
}

type Destination struct {
	Type        string
	PixKey     string
	PixKeyType string
	BankCode   string
	Agency    string
	Account   string
	AccountType string
	OwnerName string
	Document  string
}

type PayoutResponse struct {
	PayoutID    string
	Status     string
	CreatedAt  time.Time
	ArrivalDate *time.Time
}

var ErrUnknownProvider = fmt.Errorf("unknown provider type")

func NewProvider(providerType string, config map[string]string) (PaymentProvider, error) {
	switch strings.ToLower(providerType) {
	case "asaas":
		return NewAsaasProvider(config)
	case "sicoob":
		return NewSicoobProvider(config)
	case "bradesco":
		return NewBradescoProvider(config)
	case "itau":
		return NewItauProvider(config)
	case "mock":
		return NewMockProvider(), nil
	default:
		return nil, ErrUnknownProvider
	}
}
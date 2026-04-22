package provider

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type MockProvider struct {
	charges map[string]*ChargeResponse
	payouts map[string]*PayoutResponse
	webhook string
}

func NewMockProvider() *MockProvider {
	return &MockProvider{
		charges: make(map[string]*ChargeResponse),
		payouts: make(map[string]*PayoutResponse),
	}
}

func (m *MockProvider) CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	chargeID := uuid.New().String()
	now := time.Now()
	expires := now.Add(24 * time.Hour)
	response := &ChargeResponse{
		ChargeID:      chargeID,
		Status:       "PENDING",
		QRCode:       "00020101021226990014br.gov.bcb.pix2571pix@test.com/qr/h2eJ98sK",
		QRLink:       fmt.Sprintf("https://pix.app.example.com/pay/%s", chargeID),
		PixCopiaCola: "00020101021226990014br.gov.bcb.pix2571pix@test.com/qr/h2eJ98sK",
		ExpiresAt:    &expires,
	}
	m.charges[chargeID] = response
	return response, nil
}

func (m *MockProvider) CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	chargeID := uuid.New().String()
	now := time.Now()
	expires := now.Add(5 * 24 * time.Hour)
	response := &ChargeResponse{
		ChargeID:   chargeID,
		Status:    "PENDING",
		BarCode:   "00190.00001 12345.670198 76543.210123 1 890100123456",
		QRLink:    fmt.Sprintf("https://boleto.app.example.com/%s", chargeID),
		ExpiresAt: &expires,
	}
	m.charges[chargeID] = response
	return response, nil
}

func (m *MockProvider) GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error) {
	charge, ok := m.charges[chargeID]
	if !ok {
		return nil, ErrChargeNotFound
	}
	return &ChargeStatus{
		ChargeID: charge.ChargeID,
		Status:   charge.Status,
		PaidAt:   charge.PaidAt,
		Amount:  0,
	}, nil
}

func (m *MockProvider) CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error) {
	payoutID := uuid.New().String()
	now := time.Now()
	response := &PayoutResponse{
		PayoutID:    payoutID,
		Status:    "PENDING",
		CreatedAt: now,
	}
	m.payouts[payoutID] = response
	return response, nil
}

func (m *MockProvider) RegisterWebhook(ctx context.Context, url string, events []string) error {
	m.webhook = url
	return nil
}

func (m *MockProvider) GetProviderName() string {
	return "mock"
}

var ErrChargeNotFound = fmt.Errorf("charge not found")
var ErrPayoutNotFound = fmt.Errorf("payout not found")
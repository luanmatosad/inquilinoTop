# Financial Provider Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de integração com financeiras (Asaas, Sicoob, Bradesco, Itaú) para cobranca PIX/boleto e payout via interface unificada.

**Architecture:** Adapter Pattern com interface PaymentProvider. Cada provider implemented em arquivo separado. Dados armazenados em financial_config + colunas em payments.

**Tech Stack:** Go, HTTP client, pgx, golang-migrate

---

## Task 1: criar diretório provider

**Files:**
- Create: `backend/internal/payment/provider/`

```bash
mkdir -p backend/internal/payment/provider
```

- [ ] Execute: criar diretório

---

## Task 2: provider.go — Interface e tipos

**Files:**
- Create: `backend/internal/payment/provider/provider.go`

```go
package provider

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ChargeMethod string

const (
	ChargeMethodPIX   ChargeMethod = "PIX"
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
	Amount      float64
	Currency    string
	DueDate     *time.Time
	Customer    Customer
	Reference  string
	Description string
}

type Customer struct {
	Name      string
	Document  string
	Email     string
}

type ChargeResponse struct {
	ChargeID      string
	Status       string
	QRCode       string
	QRLink       string
	BarCode      string
	PixCopiaCola string
	ExpiresAt    *time.Time
	PaidAt       *time.Time
}

type ChargeStatus struct {
	ChargeID string
	Status   string
	PaidAt   *time.Time
	Amount   float64
}

type PayoutRequest struct {
	Amount       float64
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
	Agency     string
	Account    string
	AccountType string
	OwnerName  string
	Document   string
}

type PayoutResponse struct {
	PayoutID    string
	Status      string
	CreatedAt   time.Time
	ArrivalDate *time.Time
}

type ProviderConfig interface {
	GetProviderName() string
	IsActive() bool
}

func NewProvider(providerType string, config map[string]string) (PaymentProvider, error) {
	switch providerType {
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

var ErrUnknownProvider = fmt.Errorf("unknown provider type")
```

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 3: mock.go — Mock provider para testes

**Files:**
- Create: `backend/internal/payment/provider/mock.go`

```go
package provider

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type MockProvider struct {
	charges  map[string]*ChargeResponse
	payouts  map[string]*PayoutResponse
	webhook  string
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
		Amount:   req.Amount,
	}, nil
}

func (m *MockProvider) CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error) {
	payoutID := uuid.New().String()
	now := time.Now()
	response := &PayoutResponse{
		PayoutID:    payoutID,
		Status:    "PENDING",
		CreatedAt:  now,
		ArrivalDate: nil,
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
```

Observação: `req.Amount` necessário em GetChargeStatus - corrigir depois

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 4: asaas.go — Provider Asaas

**Files:**
- Create: `backend/internal/payment/provider/asaas.go`

```go
package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type AsaasProvider struct {
	apiKey       string
	environment string
	walletID    string
	baseURL     string
	client     *http.Client
}

func NewAsaasProvider(config map[string]string) (*AsaasProvider, error) {
	apiKey, ok := config["api_key"]
	if !ok {
		return nil, fmt.Errorf("asaas: api_key required")
	}
	env := config["environment"]
	if env == "" {
		env = "sandbox"
	}
	walletID := config["wallet_id"]

	baseURL := "https://api-sandbox.asaas.com"
	if env == "production" {
		baseURL = "api.asaas.com"
	}

	return &AsaasProvider{
		apiKey:       apiKey,
		environment: env,
		walletID:    walletID,
		baseURL:     baseURL,
		client:     &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (a *AsaasProvider) CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	body := map[string]interface{}{
		"name":          req.Customer.Name,
		"cpfCnpj":      req.Customer.Document,
		"email":         req.Customer.Email,
		"value":        req.Amount,
		"paymentType":   "PIX",
		"billingType":   "PIX",
		"externalRef":  req.Reference,
		"description":  req.Description,
	}
	if req.DueDate != nil {
		body["dueDate"] = req.DueDate.Format("2006-01-02")
	}

	return a.createCharge(ctx, body)
}

func (a *AsaasProvider) CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	body := map[string]interface{}{
		"name":          req.Customer.Name,
		"cpfCnpj":      req.Customer.Document,
		"email":         req.Customer.Email,
		"value":        req.Amount,
		"paymentType":   "BOLETO",
		"billingType":   "BOLETO",
		"externalRef":  req.Reference,
		"description": req.Description,
	}
	if req.DueDate != nil {
		body["dueDate"] = req.DueDate.Format("2006-01-02")
	}

	return a.createCharge(ctx, body)
}

func (a *AsaasProvider) createCharge(ctx context.Context, body map[string]interface{}) (*ChargeResponse, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("asaas: marshal error: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/v3/charges", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("asaas: request error: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("access_token", a.apiKey)

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("asaas: do error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("asaas: unexpected status %d", resp.StatusCode)
	}

	var result AsaasChargeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("asaas: decode error: %w", err)
	}

	response := &ChargeResponse{
		ChargeID: result.ID,
		Status:  result.Status,
		QRLink:  result.InvoiceURL,
	}

	if result.PixCode != "" {
		response.QRCode = result.PixCode
		response.PixCopiaCola = result.PixCode
	}
	if result.BankSlipLink != "" {
		response.QRLink = result.BankSlipLink
	}
	if result.DueDateApprove != "" {
		if t, err := time.Parse("2006-01-02", result.DueDateApprove); err == nil {
			response.ExpiresAt = &t
		}
	}

	return response, nil
}

func (a *AsaasProvider) GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", a.baseURL+"/api/v3/charges/"+chargeID, nil)
	if err != nil {
		return nil, fmt.Errorf("asaas: request error: %w", err)
	}
	httpReq.Header.Set("access_token", a.apiKey)

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("asaas: do error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrChargeNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("asaas: unexpected status %d", resp.StatusCode)
	}

	var result AsaasChargeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("asaas: decode error: %w", err)
	}

	status := &ChargeStatus{
		ChargeID: result.ID,
		Status:  result.Status,
		Amount:  result.Value,
	}

	if result.PaymentDate != "" {
		if t, err := time.Parse("2006-01-02", result.PaymentDate); err == nil {
			status.PaidAt = &t
		}
	}

	return status, nil
}

func (a *AsaasProvider) CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error) {
	body := map[string]interface{}{
		"value":  req.Amount,
		"type":  "PIX",
	}
	if req.Destination.PixKey != "" {
		body["pixAddressKey"] = req.Destination.PixKey
		body["pixAddressKeyType"] = req.Destination.PixKeyType
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("asaas: marshal error: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/v3/transfers", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("asaas: request error: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("access_token", a.apiKey)

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("asaas: do error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("asaas: unexpected status %d", resp.StatusCode)
	}

	var result AsaasTransferResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("asaas: decode error: %w", err)
	}

	return &PayoutResponse{
		PayoutID: result.ID,
		Status:  result.Status,
	}, nil
}

func (a *AsaasProvider) RegisterWebhook(ctx context.Context, url string, events []string) error {
	body := map[string]interface{}{
		"url":    url,
		"email":  "true",
		"events": events,
	}

	jsonBody, _ := json.Marshal(body)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/v3/webhooks", bytes.NewReader(jsonBody))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("access_token", a.apiKey)

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("asaas: webhook registration failed %d", resp.StatusCode)
	}

	return nil
}

func (a *AsaasProvider) GetProviderName() string {
	return "asaas"
}

type AsaasChargeResponse struct {
	ID            string  `json:"id"`
	Status        string  `json:"status"`
	Value         float64 `json:"value"`
	PixCode       string  `json:"pixCode,omitempty"`
	BankSlipLink  string  `json:"bankSlipLink,omitempty"`
	InvoiceURL   string  `json:"invoiceUrl,omitempty"`
	DueDateApprove string  `json:"dueDate"`
	PaymentDate  string  `json:"paymentDate"`
}

type AsaasTransferResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}
```

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 5: sicoob.go — Provider Sicoob

**Files:**
- Create: `backend/internal/payment/provider/sicoob.go`

```go
package provider

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type SicoobProvider struct {
	clientID     string
	clientSecret string
	certPath    string
	pixKey      string
	cooperative string
	baseURL     string
	token       string
	tokenExpiry time.Time
	client      *http.Client
}

func NewSicoobProvider(config map[string]string) (*SicoobProvider, error) {
	clientID, ok := config["client_id"]
	if !ok {
		return nil, fmt.Errorf("sicoob: client_id required")
	}
	clientSecret := config["client_secret"]
	certPath := config["certificate_path"]
	pixKey := config["pix_key"]
	cooperative := config["cooperative"]

	if certPath != "" && !exists(certPath) {
		return nil, fmt.Errorf("sicoob: certificate not found: %s", certPath)
	}

	return &SicoobProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		certPath:    certPath,
		pixKey:     pixKey,
		cooperative: cooperative,
		baseURL:    "https://cobranca.sicoob.com.br/coordenacao_banparc_api/pix/v1",
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
			},
		},
	}, nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func (s *SicoobProvider) ensureToken(ctx context.Context) error {
	if s.token != "" && time.Now().Before(s.tokenExpiry) {
		return nil
	}

	auth := map[string]string{
		"clientId":     s.clientID,
		"clientSecret": s.clientSecret,
	}
	jsonBody, _ := json.Marshal(auth)

	req, _ := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/oauth/token", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("sicoob: token error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("sicoob: token failed %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn int    `json:"expires_in"`
	}
	json.NewDecoder(resp.Body).Decode(&tokenResp)

	s.token = tokenResp.AccessToken
	s.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	return nil
}

func (s *SicoobProvider) CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	if err := s.ensureToken(ctx); err != nil {
		return nil, err
	}

	calendario := map[string]interface{}{
		"dataDeVencimento": req.DueDate.Format("2006-01-02"),
	}
	if req.DueDate != nil {
		calendario["dataDeVencimento"] = req.DueDate.Format("2006-01-02")
	}

	valor := map[string]float64{
		"original": req.Amount,
	}

	devedor := map[string]string{
		"nome":   req.Customer.Name,
		"cpf":  req.Customer.Document,
	}

	cob := map[string]interface{}{
		"calendario":        calendario,
		"txid":            req.Reference,
		"valor":           valor,
		"devedor":         devedor,
		"solicitacaoPagador": req.Description,
		"chave":           s.pixKey,
	}

	jsonBody, _ := json.Marshal(cob)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", s.baseURL+"/cob", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+s.token)

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sicoob: create charge failed %d", resp.StatusCode)
	}

	var result struct {
		TXID string `json:"txid"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	qrCode, err := s.generateQRCode(ctx, result.TXID, req.Amount)
	if err != nil {
		return nil, err
	}

	return &ChargeResponse{
		ChargeID:      result.TXID,
		Status:        "ATIVA",
		QRCode:        qrCode,
		PixCopiaCola: qrCode,
		QRLink:       "https://pix.sicoob.com.br/pay/" + result.TXID,
	}, nil
}

func (s *SicoobProvider) generateQRCode(ctx context.Context, txid string, amount float64) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", s.baseURL+"/cob/"+txid, nil)
	req.Header.Set("Authorization", "Bearer "+s.token)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var cob struct {
		Location string `json:"location"`
	}
	json.NewDecoder(resp.Body).Decode(&cob)

	return cob.Location, nil
}

func (s *SicoobProvider) CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	return nil, fmt.Errorf("sicoob: boleto not implemented")
}

func (s *SicoobProvider) GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", s.baseURL+"/cob/"+chargeID, nil)
	req.Header.Set("Authorization", "Bearer "+s.token)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrChargeNotFound
	}

	var result struct {
		Status string `json:"status"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return &ChargeStatus{
		ChargeID: chargeID,
		Status:  result.Status,
	}, nil
}

func (s *SicoobProvider) CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error) {
	return nil, fmt.Errorf("sicoob: payout not implemented")
}

func (s *SicoobProvider) RegisterWebhook(ctx context.Context, url string, events []string) error {
	return fmt.Errorf("sicoob: webhook not implemented")
}

func (s *SicoobProvider) GetProviderName() string {
	return "sicoob"
}

type SicoobTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn int    `json:"expires_in"`
	TokenType string `json:"token_type"`
}
```

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 6: bradesco.go — Provider Bradesco

**Files:**
- Create: `backend/internal/payment/provider/bradesco.go`

```go
package provider

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type BradescoProvider struct {
	clientID     string
	clientSecret string
	certPath    string
	pixKey      string
	baseURL     string
	token       string
	tokenExpiry time.Time
	client      *http.Client
}

func NewBradescoProvider(config map[string]string) (*BradescoProvider, error) {
	clientID, ok := config["client_id"]
	if !ok {
		return nil, fmt.Errorf("bradesco: client_id required")
	}
	clientSecret := config["client_secret"]
	certPath := config["certificate_path"]
	pixKey := config["pix_key"]

	if certPath != "" && !exists(certPath) {
		return nil, fmt.Errorf("bradesco: certificate not found: %s", certPath)
	}

	return &BradescoProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		certPath:    certPath,
		pixKey:     pixKey,
		baseURL:    "https://api.bradesco.com.br/open-banking/pix/v1",
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
			},
		},
	}, nil
}

func (b *BradescoProvider) CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	calendario := map[string]interface{}{
		"dataDeVencimento": req.DueDate.Format("2006-01-02"),
	}

	valor := map[string]float64{
		"original": req.Amount,
	}

	devedor := map[string]string{
		"nome": req.Customer.Name,
		"cpf": req.Customer.Document,
	}

	cob := map[string]interface{}{
		"calendario":            calendario,
		"txid":                req.Reference,
		"valor":               valor,
		"devedor":             devedor,
		"solicitacaoPagador":    req.Description,
		"chave":              b.pixKey,
	}

	jsonBody, _ := json.Marshal(cob)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", b.baseURL+"/cob", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+b.token)

	resp, err := b.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("bradesco: create charge failed %d", resp.StatusCode)
	}

	var result struct {
		TXID string `json:"txid"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return &ChargeResponse{
		ChargeID:      result.TXID,
		Status:       "ATIVA",
		QRLink:      "https://pix.bradesco.com.br/pay/" + result.TXID,
	}, nil
}

func (b *BradescoProvider) CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	return nil, fmt.Errorf("bradesco: boleto not implemented")
}

func (b *BradescoProvider) GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", b.baseURL+"/cob/"+chargeID, nil)
	req.Header.Set("Authorization", "Bearer "+b.token)

	resp, err := b.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrChargeNotFound
	}

	var result struct {
		Status string `json:"status"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return &ChargeStatus{
		ChargeID: chargeID,
		Status:  result.Status,
	}, nil
}

func (b *BradescoProvider) CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error) {
	return nil, fmt.Errorf("bradesco: payout not implemented")
}

func (b *BradescoProvider) RegisterWebhook(ctx context.Context, url string, events []string) error {
	return fmt.Errorf("bradesco: webhook not implemented")
}

func (b *BradescoProvider) GetProviderName() string {
	return "bradesco"
}
```

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 7: itau.go — Provider Itaú

**Files:**
- Create: `backend/internal/payment/provider/itau.go`

```go
package provider

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ItauProvider struct {
	clientID     string
	accessToken  string
	certPath    string
	pixKey      string
	baseURL     string
	tokenExpiry time.Time
	client      *http.Client
}

func NewItauProvider(config map[string]string) (*ItauProvider, error) {
	clientID, ok := config["client_id"]
	if !ok {
		return nil, fmt.Errorf("itau: client_id required")
	}
	accessToken := config["access_token"]
	certPath := config["certificate_path"]
	pixKey := config["pix_key"]

	return &ItauProvider{
		clientID:    clientID,
		accessToken: accessToken,
		certPath:   certPath,
		pixKey:     pixKey,
		baseURL:    "https://api.itau.com.br/open-banking/pix/v1",
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
			},
		},
	}, nil
}

func (i *ItauProvider) CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	calendario := map[string]interface{}{
		"dataDeVencimento": req.DueDate.Format("2006-01-02"),
	}

	valor := map[string]float64{
		"original": req.Amount,
	}

	devedor := map[string]string{
		"nome": req.Customer.Name,
		"cpf": req.Customer.Document,
	}

	cob := map[string]interface{}{
		"calendario":            calendario,
		"txid":                req.Reference,
		"valor":               valor,
		"devedor":             devedor,
		"solicitacaoPagador":  req.Description,
		"chave":               i.pixKey,
	}

	jsonBody, _ := json.Marshal(cob)

	httpReq, err := http.NewRequestWithContext(ctx, "POST", i.baseURL+"/cob", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+i.accessToken)

	resp, err := i.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("itau: create charge failed %d", resp.StatusCode)
	}

	var result struct {
		TXID string `json:"txid"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return &ChargeResponse{
		ChargeID: result.TXID,
		Status:  "ATIVA",
		QRLink: "https://pix.itau.com.br/pay/" + result.TXID,
	}, nil
}

func (i *ItauProvider) CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	return nil, fmt.Errorf("itau: boleto not implemented")
}

func (i *ItauProvider) GetChargeStatus(ctx context.Context, chargeID string) (*ChargeStatus, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", i.baseURL+"/cob/"+chargeID, nil)
	req.Header.Set("Authorization", "Bearer "+i.accessToken)

	resp, err := i.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrChargeNotFound
	}

	var result struct {
		Status string `json:"status"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	return &ChargeStatus{
		ChargeID: chargeID,
		Status:  result.Status,
	}, nil
}

func (i *ItauProvider) CreatePayout(ctx context.Context, req PayoutRequest) (*PayoutResponse, error) {
	return nil, fmt.Errorf("itau: payout not implemented")
}

func (i *ItauProvider) RegisterWebhook(ctx context.Context, url string, events []string) error {
	return fmt.Errorf("itau: webhook not implemented")
}

func (i *ItauProvider) GetProviderName() string {
	return "itau"
}
```

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 8: Migration — Tabela financial_config

**Files:**
- Create: `backend/migrations/000005_financial_config.up.sql`
- Create: `backend/migrations/000005_financial_config.down.sql`

```sql
-- 000005_financial_config.up.sql

CREATE TABLE financial_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(20) NOT NULL,
    config JSONB NOT NULL,
    pix_key VARCHAR(77),
    bank_info JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_financial_config_owner ON financial_config(owner_id);
CREATE INDEX idx_financial_config_active ON financial_config(owner_id, is_active);
```

```sql
-- 000005_financial_config.down.sql

DROP INDEX IF EXISTS idx_financial_config_active;
DROP INDEX IF EXISTS idx_financial_config_owner;
DROP TABLE IF EXISTS financial_config;
```

- [ ] **Step 1: Write the migration files**

---

## Task 9: Migration — Colunas em payments

**Files:**
- Create: `backend/migrations/000006_payment_charge_fields.up.sql`
- Create: `backend/migrations/000006_payment_charge_fields.down.sql`

```sql
-- 000006_payment_charge_fields.up.sql

ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_method VARCHAR(10);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_qrcode TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_link TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS charge_barcode TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_id VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS financial_config_id UUID REFERENCES financial_config(id);

CREATE INDEX IF NOT EXISTS idx_payments_charge ON payments(charge_id);
CREATE INDEX IF NOT EXISTS idx_payments_charge_ref ON payments(reference);
```

```sql
-- 000006_payment_charge_fields.down.sql

DROP INDEX IF EXISTS idx_payments_charge_ref;
DROP INDEX IF EXISTS idx_payments_charge;
ALTER TABLE payments DROP COLUMN IF EXISTS financial_config_id;
ALTER TABLE payments DROP COLUMN IF EXISTS payout_status;
ALTER TABLE payments DROP COLUMN IF EXISTS payout_id;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_barcode;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_link;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_qrcode;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_method;
ALTER TABLE payments DROP COLUMN IF EXISTS charge_id;
```

- [ ] **Step 1: Write the migration files**

---

## Task 10: Model — FinancialConfig

**Files:**
- Modify: `backend/internal/payment/model.go`
- Add new types at end

```go
type FinancialConfig struct {
	ID          uuid.UUID       `json:"id"`
	OwnerID     uuid.UUID       `json:"owner_id"`
	Provider   string         `json:"provider"`
	Config     map[string]string `json:"config,omitempty"`
	PixKey     *string        `json:"pix_key,omitempty"`
	BankInfo   *BankInfo      `json:"bank_info,omitempty"`
	IsActive   bool           `json:"is_active"`
	CreatedAt  time.Time     `json:"created_at"`
	UpdatedAt  time.Time     `json:"updated_at"`
}

type BankInfo struct {
	BankCode    string `json:"bank_code"`
	Agency     string `json:"agency"`
	Account    string `json:"account"`
	AccountType string `json:"account_type"`
	OwnerName string `json:"owner_name"`
	Document  string `json:"document"`
}

type FinancialRepository interface {
	Create(ctx context.Context, ownerID uuid.UUID, fc FinancialConfig) (*FinancialConfig, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*FinancialConfig, error)
	GetActiveByOwner(ctx context.Context, ownerID uuid.UUID) (*FinancialConfig, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, fc FinancialConfig) (*FinancialConfig, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
}

type CreateFinancialConfigInput struct {
	Provider string         `json:"provider"`
	Config  map[string]string `json:"config"`
	PixKey  *string        `json:"pix_key,omitempty"`
	BankInfo *BankInfo     `json:"bank_info,omitempty"`
}
```

- [ ] **Step 1: Add types to model.go**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 11: Repository — FinancialConfig

**Files:**
- Create: `backend/internal/payment/financial_repository.go`

```go
package payment

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/jackc/pgx/v5"
)

func (p *pgRepository) CreateFinancialConfig(ctx context.Context, ownerID uuid.UUID, in CreateFinancialConfigInput) (*FinancialConfig, error) {
	configJSON, err := json.Marshal(in.Config)
	if err != nil {
		return nil, err
	}

	var pixKeyPtr *string
	if in.PixKey != nil {
		pixKeyPtr = in.PixKey
	}

	var bankInfoJSON []byte
	if in.BankInfo != nil {
		bankInfoJSON, _ = json.Marshal(in.BankInfo)
	} else {
		bankInfoJSON = []byte("{}")
	}

	var fc FinancialConfig
	err = p.db.QueryRow(ctx,
		`INSERT INTO financial_config (owner_id, provider, config, pix_key, bank_info)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at`,
		ownerID, in.Provider, configJSON, pixKeyPtr, bankInfoJSON,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &fc.Config, &fc.PixKey, &fc.BankInfo, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &fc, nil
}

func (p *pgRepository) GetFinancialConfigByID(ctx context.Context, id, ownerID uuid.UUID) (*FinancialConfig, error) {
	var fc FinancialConfig
	configJSON := []byte("{}")
	bankInfoJSON := []byte("{}")

	err := p.db.QueryRow(ctx,
		`SELECT id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at
		 FROM financial_config WHERE id = $1 AND owner_id = $2`,
		id, ownerID,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &configJSON, &fc.PixKey, &bankInfoJSON, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, apierr.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(configJSON, &fc.Config)
	json.Unmarshal(bankInfoJSON, &fc.BankInfo)

	return &fc, nil
}

func (p *pgRepository) GetActiveFinancialConfig(ctx context.Context, ownerID uuid.UUID) (*FinancialConfig, error) {
	var fc FinancialConfig
	configJSON := []byte("{}")
	bankInfoJSON := []byte("{}")

	err := p.db.QueryRow(ctx,
		`SELECT id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at
		 FROM financial_config WHERE owner_id = $1 AND is_active = true`,
		ownerID,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &configJSON, &fc.PixKey, &bankInfoJSON, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, apierr.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	json.Unmarshal(configJSON, &fc.Config)
	json.Unmarshal(bankInfoJSON, &fc.BankInfo)

	return &fc, nil
}

func (p *pgRepository) UpdateFinancialConfig(ctx context.Context, id, ownerID uuid.UUID, in CreateFinancialConfigInput) (*FinancialConfig, error) {
	configJSON, _ := json.Marshal(in.Config)
	bankInfoJSON, _ := json.Marshal(in.BankInfo)

	var fc FinancialConfig
	err := p.db.QueryRow(ctx,
		`UPDATE financial_config SET provider = $3, config = $4, pix_key = $5, bank_info = $6, updated_at = NOW()
		 WHERE id = $1 AND owner_id = $2
		 RETURNING id, owner_id, provider, config, pix_key, bank_info, is_active, created_at, updated_at`,
		id, ownerID, in.Provider, configJSON, in.PixKey, bankInfoJSON,
	).Scan(&fc.ID, &fc.OwnerID, &fc.Provider, &fc.Config, &fc.PixKey, &fc.BankInfo, &fc.IsActive, &fc.CreatedAt, &fc.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return &fc, nil
}

func (p *pgRepository) DeleteFinancialConfig(ctx context.Context, id, ownerID uuid.UUID) error {
	result, err := p.db.Exec(ctx,
		`DELETE FROM financial_config WHERE id = $1 AND owner_id = $2`,
		id, ownerID,
	)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}
```

- [ ] **Step 1: Write the file**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 12: Service — Charge e Payout methods

**Files:**
- Modify: `backend/internal/payment/service.go`

```go
func (s *Service) CreateCharge(ctx context.Context, paymentID, ownerID uuid.UUID, method string) (*ChargeResponse, error) {
	payment, err := s.Repository.GetByID(ctx, paymentID, ownerID)
	if err != nil {
		return nil, err
	}

	if payment.Status == "PAID" {
		return nil, fmt.Errorf("payment already paid")
	}

	fc, err := s.financialRepo.GetActiveFinancialConfig(ctx, ownerID)
	if err != nil {
		return nil, fmt.Errorf("no financial config found")
	}

	prov, err := provider.NewProvider(fc.Provider, fc.Config)
	if err != nil {
		return nil, err
	}

	customer := provider.Customer{
		Name:     "Tenant",
		Document: "",
		Email:    "",
	}

	req := provider.ChargeRequest{
		Amount:      payment.GrossAmount,
		Currency:   "BRL",
		DueDate:    &payment.DueDate,
		Customer:  customer,
		Reference: paymentID.String(),
		Description: fmt.Sprintf("Pagamento %s", payment.Type),
	}

	var resp *provider.ChargeResponse

	if method == "PIX" {
		resp, err = prov.CreatePIXCharge(ctx, req)
	} else if method == "BOLETO" {
		resp, err = prov.CreateBoletoCharge(ctx, req)
	} else {
		return nil, fmt.Errorf("invalid method: %s", method)
	}

	if err != nil {
		return nil, err
	}

	err = s.Repository.UpdateChargeInfo(ctx, paymentID, ownerID, UpdateChargeInfoInput{
		ChargeID:     resp.ChargeID,
		ChargeMethod: method,
		QRCode:      resp.QRCode,
		Link:        resp.QRLink,
		BarCode:     resp.BarCode,
	})

	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (s *Service) GetChargeStatus(ctx context.Context, paymentID, ownerID uuid.UUID) (*provider.ChargeStatus, error) {
	payment, err := s.Repository.GetByID(ctx, paymentID, ownerID)
	if err != nil {
		return nil, err
	}

	if payment.ChargeID == "" {
		return nil, fmt.Errorf("no charge created")
	}

	fc, err := s.financialRepo.GetActiveFinancialConfig(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	prov, err := provider.NewProvider(fc.Provider, fc.Config)
	if err != nil {
		return nil, err
	}

	return prov.GetChargeStatus(ctx, payment.ChargeID)
}

func (s *Service) CreatePayout(ctx context.Context, paymentID, ownerID uuid.UUID, dest provider.Destination) (*provider.PayoutResponse, error) {
	payment, err := s.Repository.GetByID(ctx, paymentID, ownerID)
	if err != nil {
		return nil, err
	}

	if payment.Status != "PAID" {
		return nil, fmt.Errorf("payment not paid")
	}

	fc, err := s.financialRepo.GetActiveFinancialConfig(ctx, ownerID)
	if err != nil {
		return nil, err
	}

	prov, err := provider.NewProvider(fc.Provider, fc.Config)
	if err != nil {
		return nil, err
	}

	req := provider.PayoutRequest{
		Amount:      *payment.NetAmount,
		Currency:    "BRL",
		Destination: dest,
		Reference:   paymentID.String(),
	}

	resp, err := prov.CreatePayout(ctx, req)
	if err != nil {
		return nil, err
	}

	err = s.Repository.UpdatePayoutInfo(ctx, paymentID, ownerID, resp.PayoutID, resp.Status)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (s *Service) ProcessWebhook(ctx context.Context, providerName string, event map[string]interface{}) error {
	eventType, ok := event["event"].(string)
	if !ok {
		return fmt.Errorf("invalid webhook event")
	}

	if eventType != "PAYMENT_RECEIVED" {
		return nil
	}

	chargeID, ok := event["chargeId"].(string)
	if !ok {
		return fmt.Errorf("invalid charge id")
	}

	var payment *Payment
	payments, err := s.Repository.ListByLease(uuid.Nil(), uuid.Nil())
	if err != nil {
		return err
	}

	for _, p := range payments {
		if p.ChargeID == chargeID {
			payment = p
			break
		}
	}

	if payment == nil {
		return fmt.Errorf("payment not found for charge: %s", chargeID)
	}

	now := time.Now()
	err = s.Repository.Update(ctx, payment.ID, payment.OwnerID, UpdatePaymentInput{
		Status:    "PAID",
		PaidDate: &now,
	})
	if err != nil {
		return err
	}

	return nil
}
```

```go
type UpdateChargeInfoInput struct {
	ChargeID     string
	ChargeMethod string
	QRCode       string
	Link         string
	BarCode      string
}
```

- [ ] **Step 1: Add methods to service.go**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 13: Handlers — Charge e Payout routes

**Files:**
- Modify: `backend/internal/payment/handler.go`

```go
func (h *Handler) RegisterChargeRoutes(r *mux.Router) {
	r.HandleFunc("/payments/{id}/charge", h.handleCreateCharge).Methods(http.MethodPost)
	r.HandleFunc("/payments/{id}/charge", h.handleGetChargeStatus).Methods(http.MethodGet)
	r.HandleFunc("/payments/{id}/payout", h.handleCreatePayout).Methods(http.MethodPost)
	r.HandleFunc("/webhook/{provider}", h.handleWebhook).Methods(http.MethodPost)
}

type CreateChargeRequest struct {
	Method string `json:"method"`
}

func (h *Handler) handleCreateCharge(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, r, apierr.ErrInvalidID)
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())

	var req CreateChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Err(w, r, apierr.ErrDecode)
		return
	}

	if req.Method != "PIX" && req.Method != "BOLETO" {
		httputil.Err(w, r, fmt.Errorf("invalid method"))
		return
	}

	resp, err := h.Service.CreateCharge(r.Context(), id, ownerID, req.Method)
	if err != nil {
		httputil.Err(w, r, err)
		return
	}

	httputil.OK(w, r, resp)
}

func (h *Handler) handleGetChargeStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, r, apierr.ErrInvalidID)
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())

	status, err := h.Service.GetChargeStatus(r.Context(), id, ownerID)
	if err != nil {
		httputil.Err(w, r, err)
		return
	}

	httputil.OK(w, r, status)
}

type CreatePayoutRequest struct {
	Destination provider.Destination `json:"destination"`
}

func (h *Handler) handleCreatePayout(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, r, apierr.ErrInvalidID)
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())

	var req CreatePayoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Err(w, r, apierr.ErrDecode)
		return
	}

	resp, err := h.Service.CreatePayout(r.Context(), id, ownerID, req.Destination)
	if err != nil {
		httputil.Err(w, r, err)
		return
	}

	httputil.OK(w, r, resp)
}

func (h *Handler) handleWebhook(w http.ResponseWriter, r *http.Request) {
	provider := chi.URLParam(r, "provider")

	var event map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		httputil.Err(w, r, apierr.ErrDecode)
		return
	}

	err := h.Service.ProcessWebhook(r.Context(), provider, event)
	if err != nil {
		httputil.Err(w, r, err)
		return
	}

	httputil.OK(w, r, map[string]string{"status": "ok"})
}
```

- [ ] **Step 1: Add routes to handler.go**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

---

## Task 14: Service — Repository methods

**Files:**
- Modify: `backend/internal/payment/repository.go`

```go
func (r *pgRepository) UpdateChargeInfo(ctx context.Context, id, ownerID uuid.UUID, in UpdateChargeInfoInput) error {
	_, err := r.db.Exec(ctx,
		`UPDATE payments SET charge_id = $3, charge_method = $4, charge_qrcode = $5, charge_link = $6, charge_barcode = $7, updated_at = NOW()
		 WHERE id = $1 AND owner_id = $2`,
		id, ownerID, in.ChargeID, in.ChargeMethod, in.QRCode, in.Link, in.BarCode,
	)
	return err
}

func (r *pgRepository) UpdatePayoutInfo(ctx context.Context, id, ownerID uuid.UUID, payoutID, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE payments SET payout_id = $3, payout_status = $4, updated_at = NOW()
		 WHERE id = $1 AND owner_id = $2`,
		id, ownerID, payoutID, status,
	)
	return err
}
```

- [ ] **Step 1: Add methods to repository.go**

- [ ] **Step 2: Run go build to verify compiles**
Run: `cd backend && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**
Run: `git add backend/internal/payment/provider/ backend/migrations/000005_financial_config.up.sql backend/migrations/000005_financial_config.down.sql backend/migrations/000006_payment_charge_fields.up.sql backend/migrations/000006_payment_charge_fields.down.sql backend/internal/payment/model.go backend/internal/payment/financial_repository.go backend/internal/payment/repository.go backend/internal/payment/service.go backend/internal/payment/handler.go`
Expected: files staged

---

## Completion Summary

- [ ] **Interface PaymentProvider em provider.go**
- [ ] **Mock provider para testes**
- [ ] **Asaas provider completo**
- [ ] **Sicoob provider (PIX)**
- [ ] **Bradesco provider (PIX)**
- [ ] **Itaú provider (PIX)**
- [ ] **Tabela financial_config**
- [ ] **Colunas em payments**
- [ ] **Repository methods**
- [ ] **Service methods**
- [ ] **Handler routes**

---

> **Plan complete.** Save to `docs/superpowers/plans/2026-04-22-financial-provider-implementation.md`

**Two execution options:**

1. **Subagent-Driven (recommended)** - dispatch fresh subagent per task, review between tasks
2. **Inline Execution** - execute tasks in session with checkpoints

**Which approach?**
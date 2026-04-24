package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type AsaasProvider struct {
	apiKey       string
	environment string
	walletID    string
	baseURL     string
	client      *http.Client
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
		baseURL = "https://api.asaas.com"
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
		"name":         req.Customer.Name,
		"cpfCnpj":     req.Customer.Document,
		"email":        req.Customer.Email,
		"value":        req.Amount,
		"paymentType":  "PIX",
		"billingType":  "PIX",
		"externalRef": req.Reference,
		"description": req.Description,
	}
	if req.DueDate != nil {
		body["dueDate"] = req.DueDate.Format("2006-01-02")
	}

	return a.createCharge(ctx, body)
}

func (a *AsaasProvider) CreateBoletoCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	body := map[string]interface{}{
		"name":         req.Customer.Name,
		"cpfCnpj":     req.Customer.Document,
		"email":        req.Customer.Email,
		"value":       req.Amount,
		"paymentType":  "BOLETO",
		"billingType":  "BOLETO",
		"externalRef": req.Reference,
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
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("asaas: unexpected status %d: %s", resp.StatusCode, string(bodyBytes))
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
		"value": req.Amount,
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
		"url":   url,
		"email": "true",
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
	ID             string  `json:"id"`
	Status         string  `json:"status"`
	Value          float64 `json:"value"`
	PixCode        string  `json:"pixCode,omitempty"`
	BankSlipLink   string  `json:"bankSlipLink,omitempty"`
	InvoiceURL    string  `json:"invoiceUrl,omitempty"`
	DueDateApprove string  `json:"dueDate"`
	PaymentDate   string  `json:"paymentDate"`
}

type AsaasTransferResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}
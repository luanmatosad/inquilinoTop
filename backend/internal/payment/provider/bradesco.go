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
		pixKey:      pixKey,
		baseURL:     "https://api.bradesco.com.br/open-banking/pix/v1",
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: false},
			},
		},
	}, nil
}

func (b *BradescoProvider) ensureToken(ctx context.Context) error {
	if b.token != "" && time.Now().Before(b.tokenExpiry) {
		return nil
	}

	auth := map[string]string{
		"client_id":     b.clientID,
		"client_secret": b.clientSecret,
	}
	jsonBody, _ := json.Marshal(auth)

	req, _ := http.NewRequestWithContext(ctx, "POST", b.baseURL+"/oauth/token", bytes.NewReader(jsonBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.client.Do(req)
	if err != nil {
		return fmt.Errorf("bradesco: token error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bradesco: token failed %d", resp.StatusCode)
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn  int    `json:"expires_in"`
	}
	json.NewDecoder(resp.Body).Decode(&tokenResp)

	b.token = tokenResp.AccessToken
	b.tokenExpiry = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	return nil
}

func (b *BradescoProvider) CreatePIXCharge(ctx context.Context, req ChargeRequest) (*ChargeResponse, error) {
	if err := b.ensureToken(ctx); err != nil {
		return nil, err
	}

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
		"calendario":         calendario,
		"txid":              req.Reference,
		"valor":             valor,
		"devedor":           devedor,
		"solicitacaoPagador": req.Description,
		"chave":             b.pixKey,
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
		ChargeID: result.TXID,
		Status:  "ATIVA",
		QRLink: "https://pix.bradesco.com.br/pay/" + result.TXID,
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
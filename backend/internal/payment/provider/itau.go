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
	clientID    string
	accessToken string
	certPath    string
	pixKey      string
	baseURL    string
	tokenExpiry time.Time
	client     *http.Client
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
		"calendario":         calendario,
		"txid":              req.Reference,
		"valor":             valor,
		"devedor":           devedor,
		"solicitacaoPagador": req.Description,
		"chave":             i.pixKey,
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
		Status:   "ATIVA",
		QRLink:  "https://pix.itau.com.br/pay/" + result.TXID,
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
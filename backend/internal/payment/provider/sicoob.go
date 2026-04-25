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

type SicoobProvider struct {
	clientID     string
	clientSecret string
	certPath     string
	pixKey       string
	cooperative  string
	baseURL      string
	token        string
	tokenExpiry  time.Time
	client       *http.Client
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
		certPath:     certPath,
		pixKey:       pixKey,
		cooperative:  cooperative,
		baseURL:      "https://cobranca.sicoob.com.br/coordenacao_banparc_api/pix/v1",
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
		ExpiresIn   int    `json:"expires_in"`
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

	valor := map[string]float64{
		"original": req.Amount,
	}

	devedor := map[string]string{
		"nome": req.Customer.Name,
		"cpf":  req.Customer.Document,
	}

	cob := map[string]interface{}{
		"calendario":         calendario,
		"txid":               req.Reference,
		"valor":              valor,
		"devedor":            devedor,
		"solicitacaoPagador": req.Description,
		"chave":              s.pixKey,
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

	qrCode, err := s.generateQRCode(ctx, result.TXID)
	if err != nil {
		return nil, err
	}

	return &ChargeResponse{
		ChargeID:     result.TXID,
		Status:       "ATIVA",
		QRCode:       qrCode,
		PixCopiaCola: qrCode,
		QRLink:       "https://pix.sicoob.com.br/pay/" + result.TXID,
	}, nil
}

func (s *SicoobProvider) generateQRCode(ctx context.Context, txid string) (string, error) {
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
		Status:   result.Status,
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

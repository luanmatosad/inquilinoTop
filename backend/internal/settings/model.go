package settings

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ErrInvalidRules: algum valor das regras financeiras está fora da faixa permitida (HTTP 400).
var ErrInvalidRules = errors.New("settings: regras financeiras inválidas")

// Faixas aceitas (as mesmas dos CHECKs da migration 000052).
const (
	MaxLateFeePercent         = 10.0
	MaxMonthlyInterestPercent = 5.0
	MinReadjustNoticeDays     = 1
	MaxReadjustNoticeDays     = 180
)

// FinancialRules são os padrões da organização: valem para novos contratos e para o aviso de reajuste em Hoje.
type FinancialRules struct {
	LateFeePercent         float64 `json:"late_fee_percent"`
	MonthlyInterestPercent float64 `json:"monthly_interest_percent"`
	DefaultAdjustmentIndex string  `json:"default_adjustment_index"`
	ReadjustNoticeDays     int     `json:"readjust_notice_days"`
}

// DefaultFinancialRules são os valores de quem nunca configurou (os mesmos do canvas).
func DefaultFinancialRules() FinancialRules {
	return FinancialRules{LateFeePercent: 2, MonthlyInterestPercent: 1, DefaultAdjustmentIndex: "IGP-M", ReadjustNoticeDays: 60}
}

// PixAccount é uma conta Pix já validada e normalizada (entrada e resultado da resolução).
type PixAccount struct {
	KeyType      string `json:"key_type"`
	Key          string `json:"key"`
	ReceiverName string `json:"receiver_name"`
	City         string `json:"city"`
}

// PixInput é o corpo de `PUT /settings/pix` (chave padrão da organização).
type PixInput struct {
	KeyType      string `json:"key_type"`
	Key          string `json:"key"`
	ReceiverName string `json:"receiver_name"`
	City         string `json:"city"`
}

// UnitPixInput é o corpo de `PUT /settings/pix/units/{unitId}`. `Confirmed` precisa ser verdadeiro: quem grava
// declara que o titular da chave autorizou receber os pagamentos da unidade.
type UnitPixInput struct {
	KeyType      string `json:"key_type"`
	Key          string `json:"key"`
	ReceiverName string `json:"receiver_name"`
	Confirmed    bool   `json:"confirmed"`
}

// PixDefault é a chave padrão da organização (`configured` falso = nunca salva na tela nova).
type PixDefault struct {
	Configured   bool   `json:"configured"`
	KeyType      string `json:"key_type,omitempty"`
	Key          string `json:"key,omitempty"`
	ReceiverName string `json:"receiver_name,omitempty"`
	City         string `json:"city,omitempty"`
}

// UnitPix é a conta Pix ativa de uma unidade.
type UnitPix struct {
	UnitID       uuid.UUID `json:"unit_id"`
	KeyType      string    `json:"key_type"`
	Key          string    `json:"key"`
	ReceiverName string    `json:"receiver_name,omitempty"`
	ConfirmedAt  time.Time `json:"confirmed_at"`
}

type PixSettings struct {
	Default PixDefault `json:"default"`
	Units   []UnitPix  `json:"units"`
}

type Repository interface {
	// GetFinancialRules devolve as regras gravadas, ou nil (sem erro) se a organização nunca configurou.
	GetFinancialRules(ctx context.Context, orgID uuid.UUID) (*FinancialRules, error)
	SaveFinancialRules(ctx context.Context, orgID, userID uuid.UUID, r FinancialRules) (*FinancialRules, error)

	// GetPixDefault devolve a chave padrão da organização, ou nil se nunca foi salva.
	GetPixDefault(ctx context.Context, orgID uuid.UUID) (*PixDefault, error)
	SavePixDefault(ctx context.Context, orgID, userID uuid.UUID, a PixAccount) (*PixDefault, error)
	// GetUnitPix devolve a conta ativa da unidade, ou nil se não há (ou a unidade não é da organização).
	GetUnitPix(ctx context.Context, orgID, unitID uuid.UUID) (*UnitPix, error)
	ListUnitPix(ctx context.Context, orgID uuid.UUID) ([]UnitPix, error)
	// SaveUnitPix desativa a conta ativa (se houver) e cria a nova numa transação; apierr.ErrNotFound se a
	// unidade não é da organização. userID fica como quem confirmou.
	SaveUnitPix(ctx context.Context, orgID, unitID, userID uuid.UUID, a PixAccount) (*UnitPix, error)
	// RemoveUnitPix desativa a conta ativa; apierr.ErrNotFound se não há.
	RemoveUnitPix(ctx context.Context, orgID, unitID uuid.UUID) error
}

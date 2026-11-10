package settings

import (
	"context"
	"errors"

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

type Repository interface {
	// GetFinancialRules devolve as regras gravadas, ou nil (sem erro) se a organização nunca configurou.
	GetFinancialRules(ctx context.Context, orgID uuid.UUID) (*FinancialRules, error)
	SaveFinancialRules(ctx context.Context, orgID, userID uuid.UUID, r FinancialRules) (*FinancialRules, error)
}

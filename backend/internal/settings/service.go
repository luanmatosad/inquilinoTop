package settings

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
)

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func round2(n float64) float64 { return math.Round(n*100) / 100 }

// GetFinancialRules devolve as regras da organização, ou os padrões se ela ainda não configurou.
func (s *Service) GetFinancialRules(ctx context.Context, orgID uuid.UUID) (*FinancialRules, error) {
	r, err := s.repo.GetFinancialRules(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("settings.svc: ler regras: %w", err)
	}
	if r == nil {
		d := DefaultFinancialRules()
		return &d, nil
	}
	return r, nil
}

// SaveFinancialRules valida as faixas e grava (upsert por organização).
func (s *Service) SaveFinancialRules(ctx context.Context, orgID, userID uuid.UUID, in FinancialRules) (*FinancialRules, error) {
	in.LateFeePercent = round2(in.LateFeePercent)
	in.MonthlyInterestPercent = round2(in.MonthlyInterestPercent)
	switch {
	case in.LateFeePercent < 0 || in.LateFeePercent > MaxLateFeePercent,
		in.MonthlyInterestPercent < 0 || in.MonthlyInterestPercent > MaxMonthlyInterestPercent,
		in.DefaultAdjustmentIndex != "IGP-M" && in.DefaultAdjustmentIndex != "IPCA",
		in.ReadjustNoticeDays < MinReadjustNoticeDays || in.ReadjustNoticeDays > MaxReadjustNoticeDays:
		return nil, ErrInvalidRules
	}
	saved, err := s.repo.SaveFinancialRules(ctx, orgID, userID, in)
	if err != nil {
		return nil, fmt.Errorf("settings.svc: gravar regras: %w", err)
	}
	return saved, nil
}

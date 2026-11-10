package settings

import (
	"context"
	"fmt"
	"math"
	"strings"

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

// GetPix devolve a chave padrão e as contas ativas das unidades.
func (s *Service) GetPix(ctx context.Context, orgID uuid.UUID) (*PixSettings, error) {
	d, err := s.repo.GetPixDefault(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("settings.svc: ler pix: %w", err)
	}
	units, err := s.repo.ListUnitPix(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("settings.svc: ler pix das unidades: %w", err)
	}
	out := &PixSettings{Units: units}
	if out.Units == nil {
		out.Units = []UnitPix{}
	}
	if d != nil {
		out.Default = *d
	}
	return out, nil
}

// SavePix valida, normaliza e grava a chave padrão da organização.
func (s *Service) SavePix(ctx context.Context, orgID, userID uuid.UUID, in PixInput) (*PixDefault, error) {
	key, err := NormalizePixKey(in.KeyType, in.Key)
	if err != nil {
		return nil, err
	}
	name, city := strings.TrimSpace(in.ReceiverName), strings.TrimSpace(in.City)
	if err := ValidateReceiver(name, city); err != nil {
		return nil, err
	}
	d, err := s.repo.SavePixDefault(ctx, orgID, userID, PixAccount{KeyType: in.KeyType, Key: key, ReceiverName: name, City: city})
	if err != nil {
		return nil, fmt.Errorf("settings.svc: gravar pix: %w", err)
	}
	return d, nil
}

// SaveUnitPix grava a conta Pix da unidade. A confirmação é conferida primeiro e é obrigatória: os pagamentos da
// unidade passam a ir para outra conta.
func (s *Service) SaveUnitPix(ctx context.Context, orgID, unitID, userID uuid.UUID, in UnitPixInput) (*UnitPix, error) {
	if !in.Confirmed {
		return nil, ErrConfirmationRequired
	}
	key, err := NormalizePixKey(in.KeyType, in.Key)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.ReceiverName)
	if err := ValidateReceiver(name, ""); err != nil {
		return nil, err
	}
	u, err := s.repo.SaveUnitPix(ctx, orgID, unitID, userID, PixAccount{KeyType: in.KeyType, Key: key, ReceiverName: name})
	if err != nil {
		return nil, err
	}
	return u, nil
}

// RemoveUnitPix volta a unidade para a chave padrão (a conta fica desativada, no histórico).
func (s *Service) RemoveUnitPix(ctx context.Context, orgID, unitID uuid.UUID) error {
	return s.repo.RemoveUnitPix(ctx, orgID, unitID)
}

// ResolvePixAccount escolhe a conta Pix de uma unidade: a própria, senão a da organização, senão nil. A conta da
// unidade não traz cidade (vale a do imóvel). Usada pela cobrança para montar o código.
func (s *Service) ResolvePixAccount(ctx context.Context, orgID, unitID uuid.UUID) (*PixAccount, error) {
	u, err := s.repo.GetUnitPix(ctx, orgID, unitID)
	if err != nil {
		return nil, fmt.Errorf("settings.svc: pix da unidade: %w", err)
	}
	if u != nil {
		return &PixAccount{KeyType: u.KeyType, Key: u.Key, ReceiverName: u.ReceiverName}, nil
	}
	d, err := s.repo.GetPixDefault(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("settings.svc: pix da organização: %w", err)
	}
	if d == nil || !d.Configured {
		return nil, nil
	}
	return &PixAccount{KeyType: d.KeyType, Key: d.Key, ReceiverName: d.ReceiverName, City: d.City}, nil
}

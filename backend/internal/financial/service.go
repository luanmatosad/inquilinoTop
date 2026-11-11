package financial

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"time"

	"github.com/google/uuid"
)

var periodRe = regexp.MustCompile(`^[0-9]{4}-(0[1-9]|1[0-2])$`)

// allowedNext: única transição válida de cada status (um passo por vez).
var allowedNext = map[string]string{
	StatusPending:   StatusProcessed,
	StatusProcessed: StatusTransferred,
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CalcTransfer devolve a taxa administrativa e o líquido: taxa = bruto × %/100 (2 casas),
// líquido = bruto − taxa − descontos. Líquido negativo é rejeitado.
func CalcTransfer(gross, feePercent, discounts float64) (fee, net float64, err error) {
	if discounts < 0 {
		return 0, 0, ErrInvalidDiscounts
	}
	fee = round2(gross * feePercent / 100)
	net = round2(gross - fee - discounts)
	if net < 0 {
		return 0, 0, ErrDiscountsExceedGross
	}
	return fee, net, nil
}

// GenerateTransfers cria um repasse PENDING por imóvel com aluguel PAID na competência.
// Idempotente: repasses já existentes (mesmo imóvel e competência) não são alterados.
func (s *Service) GenerateTransfers(ctx context.Context, orgID uuid.UUID, period string) (int, error) {
	if !periodRe.MatchString(period) {
		return 0, ErrInvalidPeriod
	}
	feePercent, err := s.repo.AdminFeePercent(ctx, orgID)
	if err != nil {
		return 0, fmt.Errorf("financial.service: taxa administrativa: %w", err)
	}
	gross, err := s.repo.PaidRentByProperty(ctx, orgID, period)
	if err != nil {
		return 0, fmt.Errorf("financial.service: aluguel pago: %w", err)
	}
	rows := make([]Transfer, 0, len(gross))
	for _, g := range gross {
		fee, net, err := CalcTransfer(g.Gross, feePercent, 0)
		if err != nil {
			return 0, fmt.Errorf("financial.service: calcular repasse: %w", err)
		}
		rows = append(rows, Transfer{
			PropertyID:      g.PropertyID,
			Period:          period,
			GrossAmount:     round2(g.Gross),
			AdminFeePercent: feePercent,
			AdminFeeAmount:  fee,
			Discounts:       0,
			NetAmount:       net,
			Status:          StatusPending,
		})
	}
	if len(rows) == 0 {
		return 0, nil
	}
	n, err := s.repo.InsertTransfers(ctx, orgID, period, rows)
	if err != nil {
		return 0, fmt.Errorf("financial.service: gravar repasses: %w", err)
	}
	return n, nil
}

// GetAdminFeePercent devolve a taxa administrativa da organização (0 se não configurada).
func (s *Service) GetAdminFeePercent(ctx context.Context, orgID uuid.UUID) (float64, error) {
	return s.repo.AdminFeePercent(ctx, orgID)
}

// SetAdminFeePercent grava a taxa administrativa (0 a 100, duas casas).
func (s *Service) SetAdminFeePercent(ctx context.Context, orgID uuid.UUID, pct float64) error {
	pct = round2(pct)
	if pct < 0 || pct > 100 {
		return ErrInvalidAdminFee
	}
	return s.repo.SetAdminFeePercent(ctx, orgID, pct)
}

func (s *Service) ListTransfers(ctx context.Context, orgID uuid.UUID, f TransferFilter) ([]Transfer, error) {
	if (f.From != "" && !periodRe.MatchString(f.From)) || (f.To != "" && !periodRe.MatchString(f.To)) {
		return nil, ErrInvalidPeriod
	}
	return s.repo.ListTransfers(ctx, orgID, f)
}

// UpdateTransfer aplica mudanças de status (um passo por vez) e/ou de descontos (só em PENDING).
func (s *Service) UpdateTransfer(ctx context.Context, orgID, id uuid.UUID, in UpdateTransferInput) (*Transfer, error) {
	t, err := s.repo.GetTransfer(ctx, id, orgID)
	if err != nil {
		return nil, fmt.Errorf("financial.service: buscar repasse: %w", err)
	}
	expected := t.Status

	if in.Discounts != nil {
		if t.Status != StatusPending {
			return nil, ErrTransferLocked
		}
		if *in.Discounts < 0 {
			return nil, ErrInvalidDiscounts
		}
		net := round2(t.GrossAmount - t.AdminFeeAmount - *in.Discounts)
		if net < 0 {
			return nil, ErrDiscountsExceedGross
		}
		t.Discounts = round2(*in.Discounts)
		t.NetAmount = net
	}

	if in.Status != nil {
		if allowedNext[t.Status] != *in.Status {
			return nil, ErrInvalidTransition
		}
		t.Status = *in.Status
		if t.Status == StatusTransferred {
			now := time.Now().UTC()
			t.TransferredAt = &now
		}
	}

	if err := s.repo.SaveTransfer(ctx, orgID, t, expected); err != nil {
		return nil, fmt.Errorf("financial.service: gravar repasse: %w", err)
	}
	return t, nil
}

// ImportBankRecords grava as linhas do extrato. Linhas já existentes (reimportação) não duplicam,
// mas ainda tentam conciliação: um pagamento pode ter virado PAID depois da primeira importação.
// Unmatched lista os lançamentos que continuam sem pagamento após a importação.
func (s *Service) ImportBankRecords(ctx context.Context, orgID uuid.UUID, rows []BankRecordInput) (ImportResult, error) {
	res := ImportResult{Unmatched: []BankRecord{}}
	for _, row := range rows {
		id, inserted, err := s.repo.InsertBankRecord(ctx, orgID, row)
		if err != nil {
			return ImportResult{}, fmt.Errorf("financial.service: gravar lançamento: %w", err)
		}
		if inserted {
			res.Imported++
		} else {
			res.Duplicate++
		}

		var paymentID *uuid.UUID
		if row.Type == TypeCredit {
			paymentID, err = s.repo.MatchBankRecord(ctx, orgID, id)
			if err != nil {
				return ImportResult{}, fmt.Errorf("financial.service: conciliar lançamento: %w", err)
			}
		}
		if paymentID != nil {
			res.Matched++
			continue
		}
		res.Unmatched = append(res.Unmatched, BankRecord{
			ID: id, Date: row.Date, Description: row.Description, Amount: row.Amount, Type: row.Type,
		})
	}
	return res, nil
}

func (s *Service) ListBankRecords(ctx context.Context, orgID uuid.UUID, f BankRecordFilter) ([]BankRecord, error) {
	return s.repo.ListBankRecords(ctx, orgID, f)
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

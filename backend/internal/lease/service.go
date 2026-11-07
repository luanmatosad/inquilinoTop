package lease

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

type Service struct {
	repo      Repository
	readjRepo ReadjustmentRepository
	indexRepo IndexRepository
	units     UnitReader
	tenants   TenantReader
	payments  PaymentHooks
	now       func() time.Time
}

func NewService(repo Repository, readjRepo ReadjustmentRepository, indexRepo IndexRepository) *Service {
	return &Service{repo: repo, readjRepo: readjRepo, indexRepo: indexRepo, now: time.Now}
}

// WithRefs habilita a checagem de unidade e inquilino ativos da organização na criação.
func (s *Service) WithRefs(units UnitReader, tenants TenantReader) *Service {
	s.units, s.tenants = units, tenants
	return s
}

// WithPayments habilita geração de cobranças na criação e cancelamento das futuras no encerramento.
func (s *Service) WithPayments(p PaymentHooks) *Service {
	s.payments = p
	return s
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// checkOverlap rejeita período que cruze outro contrato ACTIVE da mesma unidade.
func (s *Service) checkOverlap(ctx context.Context, unitID, orgID uuid.UUID, start time.Time, end *time.Time, exceptID uuid.UUID) error {
	overlap, err := s.repo.HasOverlap(ctx, unitID, orgID, start, end, exceptID)
	if err != nil {
		return fmt.Errorf("lease.svc: checar sobreposição: %w", err)
	}
	if overlap {
		return ErrLeaseOverlap
	}
	return nil
}

// decorate preenche os campos calculados do contrato (hoje, só o próximo reajuste).
func decorate(l *Lease) *Lease {
	if l != nil {
		l.NextReadjustment = NextReadjustment(l.AdjustmentMonth, l.StartDate, l.LastReadjustedAt)
	}
	return l
}

func (s *Service) Create(ctx context.Context, orgID, ownerID uuid.UUID, in CreateLeaseInput) (*CreateOutput, error) {
	if in.UnitID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: unit_id é obrigatório")
	}
	if in.TenantID == uuid.Nil {
		return nil, fmt.Errorf("lease.svc: tenant_id é obrigatório")
	}
	if in.RentAmount <= 0 {
		return nil, fmt.Errorf("lease.svc: rent_amount deve ser positivo")
	}
	if in.PaymentDay != 0 && (in.PaymentDay < 1 || in.PaymentDay > 31) {
		return nil, fmt.Errorf("lease.svc: payment_day deve estar entre 1 e 31")
	}
	if in.EndDate != nil && !in.EndDate.After(in.StartDate) {
		return nil, ErrInvalidDates
	}
	if s.units != nil {
		if _, err := s.units.GetUnit(ctx, in.UnitID, orgID); err != nil {
			if errors.Is(err, apierr.ErrNotFound) {
				return nil, ErrUnitNotFound
			}
			return nil, fmt.Errorf("lease.svc: buscar unidade: %w", err)
		}
	}
	if s.tenants != nil {
		if _, err := s.tenants.GetByID(ctx, in.TenantID, orgID); err != nil {
			if errors.Is(err, apierr.ErrNotFound) {
				return nil, ErrTenantNotFound
			}
			return nil, fmt.Errorf("lease.svc: buscar inquilino: %w", err)
		}
	}
	if err := s.checkOverlap(ctx, in.UnitID, orgID, in.StartDate, in.EndDate, uuid.Nil); err != nil {
		return nil, err
	}
	if in.AdjustmentMonth == nil {
		m := int(in.StartDate.Month())
		in.AdjustmentMonth = &m
	}

	l, err := s.repo.Create(ctx, orgID, ownerID, in)
	if err != nil {
		return nil, err
	}
	out := &CreateOutput{Lease: decorate(l)}
	if in.GeneratePayments && s.payments != nil {
		out.PaymentsGenerated, err = s.generateInitialPayments(ctx, ownerID, orgID, l)
		if err != nil {
			slog.Error("lease: geração inicial de cobranças falhou", "lease_id", l.ID, "generated", out.PaymentsGenerated, "error", err)
			out.PaymentsError = err.Error()
		}
	}
	return out, nil
}

// generateInitialPayments gera uma cobrança por competência, do início até end_date,
// limitado a MaxInitialPayments meses (contrato aberto gera exatamente esse máximo).
func (s *Service) generateInitialPayments(ctx context.Context, userID, orgID uuid.UUID, l *Lease) (int, error) {
	first := time.Date(l.StartDate.Year(), l.StartDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	count := MaxInitialPayments
	if l.EndDate != nil {
		months := (l.EndDate.Year()-l.StartDate.Year())*12 + int(l.EndDate.Month()) - int(l.StartDate.Month()) + 1
		if months < count {
			count = months
		}
	}
	generated := 0
	for i := 0; i < count; i++ {
		month := first.AddDate(0, i, 0).Format("2006-01")
		if err := s.payments.GenerateRentMonth(ctx, userID, l.ID, orgID, month); err != nil {
			return generated, fmt.Errorf("competência %s: %w", month, err)
		}
		generated++
	}
	return generated, nil
}

func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Lease, error) {
	l, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	return decorate(l), nil
}

func (s *Service) List(ctx context.Context, orgID uuid.UUID) ([]Lease, error) {
	list, err := s.repo.List(ctx, orgID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		decorate(&list[i])
	}
	return list, nil
}

func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	if in.PaymentDay != nil && (*in.PaymentDay < 1 || *in.PaymentDay > 31) {
		return nil, fmt.Errorf("lease.svc: payment_day deve estar entre 1 e 31")
	}
	if in.Status != "" && in.Status != "ACTIVE" && in.Status != "ENDED" && in.Status != "CANCELED" {
		return nil, fmt.Errorf("lease.svc: status inválido")
	}
	current, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if in.Status != "" && in.Status != current.Status {
		return nil, ErrStatusChange
	}
	in.Status = current.Status
	if in.EndDate != nil && !in.EndDate.After(current.StartDate) {
		return nil, ErrInvalidDates
	}
	if current.Status == "ACTIVE" {
		if err := s.checkOverlap(ctx, current.UnitID, orgID, current.StartDate, in.EndDate, id); err != nil {
			return nil, err
		}
	}
	if in.AdjustmentMonth == nil {
		in.AdjustmentMonth = current.AdjustmentMonth
	}
	updated, err := s.repo.Update(ctx, id, orgID, in)
	if err != nil {
		return nil, err
	}
	return decorate(updated), nil
}

func (s *Service) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	return s.repo.Delete(ctx, id, orgID)
}

// End encerra o contrato ACTIVE e retira as cobranças futuras pendentes sem cobrança emitida.
// Falha no cancelamento não desfaz o encerramento: vai em PaymentsError para o usuário agir.
// End encerra o contrato. A data de saída padrão é hoje; nunca antes do início do contrato. As cobranças
// futuras são canceladas a partir da data de saída efetiva (a saída nunca estende o prazo previsto).
func (s *Service) End(ctx context.Context, id, orgID uuid.UUID, in EndLeaseInput) (*EndOutput, error) {
	if in.Reason != nil && !EndReasons[*in.Reason] {
		return nil, fmt.Errorf("lease.svc: motivo de encerramento inválido")
	}
	current, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if current.Status != "ACTIVE" {
		return nil, fmt.Errorf("lease.svc: %w", ErrLeaseNotActive)
	}
	endDate := dateOnly(s.now())
	if in.EndDate != nil {
		endDate = dateOnly(*in.EndDate)
	}
	if endDate.Before(dateOnly(current.StartDate)) {
		return nil, ErrInvalidDates
	}
	ended, err := s.repo.End(ctx, id, orgID, endDate, in.Reason)
	if err != nil {
		return nil, err
	}
	out := &EndOutput{Lease: decorate(ended)}
	if s.payments != nil {
		cutoff := endDate
		if ended.EndDate != nil {
			cutoff = dateOnly(*ended.EndDate)
		}
		out.PaymentsCanceled, out.PaymentsNeedReview, err = s.payments.CancelFuturePending(ctx, id, orgID, cutoff)
		if err != nil {
			slog.Error("lease: cancelar cobranças futuras falhou", "lease_id", id, "error", err)
			out.PaymentsError = err.Error()
		}
	}
	return out, nil
}

func (s *Service) Renew(ctx context.Context, id, orgID uuid.UUID, in RenewLeaseInput) (*Lease, error) {
	if in.NewEndDate.IsZero() {
		return nil, fmt.Errorf("lease.svc: new_end_date é obrigatório")
	}
	if in.PaymentDay != nil && (*in.PaymentDay < 1 || *in.PaymentDay > 31) {
		return nil, fmt.Errorf("lease.svc: payment_day deve estar entre 1 e 31")
	}
	current, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if current.Status != "ACTIVE" {
		return nil, fmt.Errorf("lease.svc: %w", ErrLeaseNotActive)
	}
	if !in.NewEndDate.After(current.StartDate) || (current.EndDate != nil && !in.NewEndDate.After(*current.EndDate)) {
		return nil, ErrInvalidDates
	}
	if err := s.checkOverlap(ctx, current.UnitID, orgID, current.StartDate, &in.NewEndDate, id); err != nil {
		return nil, err
	}
	renewed, err := s.repo.Renew(ctx, id, orgID, in)
	if err != nil {
		return nil, err
	}
	return decorate(renewed), nil
}

type ReadjustOutput struct {
	Lease        *Lease        `json:"lease"`
	Readjustment *Readjustment `json:"readjustment"`
	// PaymentsUpdated conta as cobranças futuras que passaram ao novo aluguel; PaymentsNeedReview, as que já têm
	// cobrança emitida e ficaram no valor antigo; PaymentsError, a falha ao atualizá-las (o reajuste do contrato vale).
	PaymentsUpdated    int    `json:"payments_updated"`
	PaymentsNeedReview int    `json:"payments_need_review"`
	PaymentsError      string `json:"payments_error,omitempty"`
}

func (s *Service) Readjust(ctx context.Context, id, orgID uuid.UUID, in ReadjustInput) (*ReadjustOutput, error) {
	if in.Percentage <= 0 || in.Percentage > 1 {
		return nil, fmt.Errorf("lease.svc: %w", ErrInvalidPercentage)
	}
	l, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: %w", err)
	}
	if l.Status != "ACTIVE" {
		return nil, fmt.Errorf("lease.svc: %w", ErrLeaseNotActive)
	}
	oldAmount := l.RentAmount
	newAmount := round2(oldAmount * (1 + in.Percentage))

	updated, err := s.repo.UpdateRentAmount(ctx, id, orgID, newAmount)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: readjust update: %w", err)
	}
	r, err := s.readjRepo.Create(ctx, &Readjustment{
		LeaseID: id, OrganizationID: orgID, AppliedAt: in.AppliedAt,
		OldAmount: oldAmount, NewAmount: newAmount, Percentage: in.Percentage,
		IndexName: in.IndexName, Notes: in.Notes,
	})
	if err != nil {
		return nil, fmt.Errorf("lease.svc: readjust persist: %w", err)
	}
	// O RETURNING do UPDATE saiu antes de o reajuste ser gravado: o reajuste recém-aplicado vale como último.
	if updated.LastReadjustedAt == nil || in.AppliedAt.After(*updated.LastReadjustedAt) {
		applied := in.AppliedAt
		updated.LastReadjustedAt = &applied
	}
	out := &ReadjustOutput{Lease: decorate(updated), Readjustment: r}
	if s.payments != nil {
		// O reajuste do contrato já valeu: se atualizar as cobranças falhar, o erro vai na resposta e no log.
		out.PaymentsUpdated, out.PaymentsNeedReview, err = s.payments.ReadjustFuturePending(ctx, id, orgID, dateOnly(in.AppliedAt), newAmount)
		if err != nil {
			slog.Error("lease: atualizar cobranças futuras falhou", "lease_id", id, "error", err)
			out.PaymentsError = err.Error()
		}
	}
	return out, nil
}

func (s *Service) ListReadjustments(ctx context.Context, leaseID, orgID uuid.UUID) ([]Readjustment, error) {
	return s.readjRepo.ListByLease(ctx, leaseID, orgID)
}

func round2(x float64) float64 {
	return math.Round(x*100) / 100
}

func (s *Service) GetIndexHistory(ctx context.Context, indexType string) ([]IndexValue, error) {
	return s.indexRepo.GetHistory(ctx, indexType)
}

func (s *Service) AdjustByAutoIndex(ctx context.Context, id, orgID uuid.UUID, in AdjustLeaseInput) (*ReadjustOutput, error) {
	idx, err := s.indexRepo.GetLatest(ctx, in.IndexType)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: auto adjust get index: %w", err)
	}

	l, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: auto adjust get lease: %w", err)
	}

	if l.Status != "ACTIVE" {
		return nil, fmt.Errorf("lease.svc: %w", ErrLeaseNotActive)
	}

	readjustIn := ReadjustInput{
		Percentage: idx.Cumulative,
		IndexName:  &idx.IndexType,
		AppliedAt:  idx.ReferenceMonth,
	}
	return s.Readjust(ctx, id, orgID, readjustIn)
}

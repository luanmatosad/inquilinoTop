package lease

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
)

type Service struct {
	repo      Repository
	readjRepo ReadjustmentRepository
}

func NewService(repo Repository, readjRepo ReadjustmentRepository) *Service {
	return &Service{repo: repo, readjRepo: readjRepo}
}

func (s *Service) Create(ctx context.Context, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
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
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) Get(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) List(ctx context.Context, ownerID uuid.UUID) ([]Lease, error) {
	return s.repo.List(ctx, ownerID)
}

func (s *Service) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	if in.Status != "ACTIVE" && in.Status != "ENDED" && in.Status != "CANCELED" {
		return nil, fmt.Errorf("lease.svc: status inválido")
	}
	if in.PaymentDay != nil && (*in.PaymentDay < 1 || *in.PaymentDay > 31) {
		return nil, fmt.Errorf("lease.svc: payment_day deve estar entre 1 e 31")
	}
	return s.repo.Update(ctx, id, ownerID, in)
}

func (s *Service) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	return s.repo.Delete(ctx, id, ownerID)
}

func (s *Service) End(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	return s.repo.End(ctx, id, ownerID)
}

func (s *Service) Renew(ctx context.Context, id, ownerID uuid.UUID, in RenewLeaseInput) (*Lease, error) {
	if in.NewEndDate.IsZero() {
		return nil, fmt.Errorf("lease.svc: new_end_date é obrigatório")
	}
	if in.PaymentDay != nil && (*in.PaymentDay < 1 || *in.PaymentDay > 31) {
		return nil, fmt.Errorf("lease.svc: payment_day deve estar entre 1 e 31")
	}
	return s.repo.Renew(ctx, id, ownerID, in)
}

type ReadjustOutput struct {
	Lease        *Lease        `json:"lease"`
	Readjustment *Readjustment `json:"readjustment"`
}

func (s *Service) Readjust(ctx context.Context, id, ownerID uuid.UUID, in ReadjustInput) (*ReadjustOutput, error) {
	if in.Percentage <= 0 || in.Percentage > 1 {
		return nil, fmt.Errorf("lease.svc: percentage deve estar em (0, 1]")
	}
	l, err := s.repo.GetByID(ctx, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: %w", err)
	}
	if l.Status != "ACTIVE" {
		return nil, fmt.Errorf("lease.svc: lease not active")
	}
	oldAmount := l.RentAmount
	newAmount := round2(oldAmount * (1 + in.Percentage))

	updated, err := s.repo.UpdateRentAmount(ctx, id, ownerID, newAmount)
	if err != nil {
		return nil, fmt.Errorf("lease.svc: readjust update: %w", err)
	}
	r, err := s.readjRepo.Create(ctx, &Readjustment{
		LeaseID: id, OwnerID: ownerID, AppliedAt: in.AppliedAt,
		OldAmount: oldAmount, NewAmount: newAmount, Percentage: in.Percentage,
		IndexName: in.IndexName, Notes: in.Notes,
	})
	if err != nil {
		return nil, fmt.Errorf("lease.svc: readjust persist: %w", err)
	}
	return &ReadjustOutput{Lease: updated, Readjustment: r}, nil
}

func (s *Service) ListReadjustments(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Readjustment, error) {
	return s.readjRepo.ListByLease(ctx, leaseID, ownerID)
}

func round2(x float64) float64 {
	return math.Round(x*100) / 100
}

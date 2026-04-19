package payment

import (
	"fmt"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	if in.LeaseID == uuid.Nil {
		return nil, fmt.Errorf("payment.svc: lease_id é obrigatório")
	}
	if in.Amount <= 0 {
		return nil, fmt.Errorf("payment.svc: amount deve ser positivo")
	}
	validTypes := map[string]bool{"RENT": true, "DEPOSIT": true, "EXPENSE": true, "OTHER": true}
	if !validTypes[in.Type] {
		return nil, fmt.Errorf("payment.svc: type inválido")
	}
	return s.repo.Create(ownerID, in)
}

func (s *Service) Get(id, ownerID uuid.UUID) (*Payment, error) {
	return s.repo.GetByID(id, ownerID)
}

func (s *Service) ListByLease(leaseID, ownerID uuid.UUID) ([]Payment, error) {
	return s.repo.ListByLease(leaseID, ownerID)
}

func (s *Service) Update(id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	validStatuses := map[string]bool{"PENDING": true, "PAID": true, "LATE": true}
	if !validStatuses[in.Status] {
		return nil, fmt.Errorf("payment.svc: status inválido")
	}
	return s.repo.Update(id, ownerID, in)
}

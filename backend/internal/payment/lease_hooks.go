package payment

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// LeaseHooks adapta Service para a interface lease.PaymentHooks sem que lease
// importe payment (payment já importa lease).
type LeaseHooks struct {
	svc *Service
}

func NewLeaseHooks(svc *Service) *LeaseHooks {
	return &LeaseHooks{svc: svc}
}

// GenerateRentMonth gera (idempotente) a cobrança de aluguel da competência "YYYY-MM".
func (h *LeaseHooks) GenerateRentMonth(ctx context.Context, userID, leaseID, orgID uuid.UUID, month string) error {
	_, err := h.svc.GenerateMonth(ctx, userID, leaseID, orgID, month)
	return err
}

// CancelFuturePending retira as cobranças pendentes futuras sem cobrança emitida e
// informa quantas, já emitidas, ficaram para decisão manual.
func (h *LeaseHooks) CancelFuturePending(ctx context.Context, leaseID, orgID uuid.UUID, after time.Time) (canceled, needsReview int, err error) {
	res, err := h.svc.CancelFuturePending(ctx, leaseID, orgID, after)
	return res.Deactivated, res.NeedsReview, err
}

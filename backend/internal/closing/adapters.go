package closing

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/tenant"
)

type PaymentLister interface {
	List(ctx context.Context, orgID uuid.UUID, f payment.PaymentFilter) ([]payment.Payment, error)
}

type LeaseReader interface {
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*lease.Lease, error)
}

type TenantReader interface {
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*tenant.Tenant, error)
}

type paymentSource struct {
	payments PaymentLister
	leases   LeaseReader
	tenants  TenantReader
}

// NewPaymentSource lê as cobranças de aluguel do mês pelo service de pagamentos (já com LATE calculado).
func NewPaymentSource(p PaymentLister, l LeaseReader, t TenantReader) PaymentSource {
	return &paymentSource{payments: p, leases: l, tenants: t}
}

func (s *paymentSource) RentOfMonth(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]PaymentFact, error) {
	list, err := s.payments.List(ctx, orgID, payment.PaymentFilter{From: &from, To: &to})
	if err != nil {
		return nil, err
	}
	names := map[uuid.UUID]string{}
	out := make([]PaymentFact, 0, len(list))
	for _, p := range list {
		if p.Type != "RENT" {
			continue
		}
		name, ok := names[p.LeaseID]
		if !ok {
			name = "—"
			if l, err := s.leases.GetByID(ctx, p.LeaseID, orgID); err == nil {
				if t, err := s.tenants.GetByID(ctx, l.TenantID, orgID); err == nil {
					name = t.Name
				}
			}
			names[p.LeaseID] = name
		}
		out = append(out, PaymentFact{
			ID: p.ID, Tenant: name, DueDate: p.DueDate, Gross: p.GrossAmount,
			Paid: p.Status == "PAID", Awaiting: p.Status != "PAID" && p.AwaitingConfirmation,
			HasReceipt: p.ReceiptNumber != nil,
		})
	}
	return out, nil
}

type nameReader struct{ repo identity.Repository }

// NewNameReader devolve o nome do perfil (ou o e-mail) para o histórico do fechamento.
func NewNameReader(repo identity.Repository) NameReader { return &nameReader{repo: repo} }

func (n *nameReader) Name(ctx context.Context, userID uuid.UUID) string {
	u, err := n.repo.GetUserByID(ctx, userID)
	if err != nil {
		return "Usuário"
	}
	name := u.Email
	if prof, err := n.repo.GetProfile(ctx, userID); err == nil && prof != nil && prof.FullName != nil && strings.TrimSpace(*prof.FullName) != "" {
		name = strings.TrimSpace(*prof.FullName)
	}
	return name
}

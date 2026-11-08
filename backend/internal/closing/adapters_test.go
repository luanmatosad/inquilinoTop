package closing_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/closing"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type fakeLister struct {
	list []payment.Payment
	f    payment.PaymentFilter
}

func (l *fakeLister) List(_ context.Context, _ uuid.UUID, f payment.PaymentFilter) ([]payment.Payment, error) {
	l.f = f
	return l.list, nil
}

type fakeLeases struct{ tenantID uuid.UUID }

func (f fakeLeases) GetByID(_ context.Context, id, _ uuid.UUID) (*lease.Lease, error) {
	return &lease.Lease{ID: id, TenantID: f.tenantID}, nil
}

type fakeTenants struct{ missing bool }

func (f fakeTenants) GetByID(_ context.Context, id, _ uuid.UUID) (*tenant.Tenant, error) {
	if f.missing {
		return nil, apierr.ErrNotFound
	}
	return &tenant.Tenant{ID: id, Name: "Marina Souza"}, nil
}

func TestAdapter_RentOfMonth(t *testing.T) {
	leaseID := uuid.New()
	num := 7
	due := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	lister := &fakeLister{list: []payment.Payment{
		{ID: uuid.New(), LeaseID: leaseID, Type: "RENT", Status: "PAID", GrossAmount: 1850, DueDate: due, ReceiptNumber: &num},
		{ID: uuid.New(), LeaseID: leaseID, Type: "RENT", Status: "LATE", GrossAmount: 1000, DueDate: due, AwaitingConfirmation: true},
		{ID: uuid.New(), LeaseID: leaseID, Type: "DEPOSIT", Status: "PAID", GrossAmount: 5000, DueDate: due},
	}}
	a := closing.NewPaymentSource(lister, fakeLeases{tenantID: uuid.New()}, fakeTenants{})
	from := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)

	facts, err := a.RentOfMonth(context.Background(), uuid.New(), from, to)
	require.NoError(t, err)
	require.Len(t, facts, 2, "só aluguel")
	assert.True(t, facts[0].Paid)
	assert.True(t, facts[0].HasReceipt)
	assert.Equal(t, "Marina Souza", facts[0].Tenant)
	assert.False(t, facts[1].Paid)
	assert.True(t, facts[1].Awaiting)
	require.NotNil(t, lister.f.From)
	assert.Equal(t, from, *lister.f.From)
	assert.Equal(t, to, *lister.f.To)
}

func TestAdapter_InquilinoAusente(t *testing.T) {
	lister := &fakeLister{list: []payment.Payment{{ID: uuid.New(), LeaseID: uuid.New(), Type: "RENT", Status: "PENDING", GrossAmount: 10}}}
	a := closing.NewPaymentSource(lister, fakeLeases{tenantID: uuid.New()}, fakeTenants{missing: true})
	facts, err := a.RentOfMonth(context.Background(), uuid.New(), time.Now(), time.Now())
	require.NoError(t, err)
	assert.Equal(t, "—", facts[0].Tenant)
}

package payment_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockPaymentRepo struct {
	payments map[uuid.UUID]*payment.Payment
}

func newMockPaymentRepo() *mockPaymentRepo {
	return &mockPaymentRepo{payments: make(map[uuid.UUID]*payment.Payment)}
}

func (m *mockPaymentRepo) Create(_ context.Context, ownerID uuid.UUID, in payment.CreatePaymentInput) (*payment.Payment, error) {
	p := &payment.Payment{
		ID:         uuid.New(),
		OwnerID:    ownerID,
		LeaseID:    in.LeaseID,
		DueDate:    in.DueDate,
		GrossAmount: in.GrossAmount,
		Type:       in.Type,
		Status:     "PENDING",
	}
	m.payments[p.ID] = p
	return p, nil
}

func (m *mockPaymentRepo) CreateIfAbsent(_ context.Context, ownerID uuid.UUID, in payment.CreatePaymentInput) (*payment.Payment, bool, error) {
	p, err := m.Create(context.Background(), ownerID, in)
	if err != nil {
		return nil, false, err
	}
	return p, true, nil
}

func (m *mockPaymentRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*payment.Payment, error) {
	p, ok := m.payments[id]
	if !ok || p.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return p, nil
}

func (m *mockPaymentRepo) ListByLease(_ context.Context, leaseID, ownerID uuid.UUID) ([]payment.Payment, error) {
	var list []payment.Payment
	for _, p := range m.payments {
		if p.LeaseID == leaseID && p.OwnerID == ownerID {
			list = append(list, *p)
		}
	}
	return list, nil
}

func (m *mockPaymentRepo) Update(_ context.Context, id, ownerID uuid.UUID, in payment.UpdatePaymentInput) (*payment.Payment, error) {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	p.Status = in.Status
	p.GrossAmount = in.GrossAmount
	p.PaidDate = in.PaidDate
	return p, nil
}

func (m *mockPaymentRepo) MarkPaid(_ context.Context, id, ownerID uuid.UUID, paidDate time.Time,
	lateFee, interest, irrf, netAmount float64) (*payment.Payment, error) {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	p.Status = "PAID"
	p.PaidDate = &paidDate
	p.LateFeeAmount = lateFee
	p.InterestAmount = interest
	p.IRRFAmount = irrf
	p.NetAmount = &netAmount
	return p, nil
}

func TestService_Create_Válido(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()
	leaseID := uuid.New()

	p, err := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID,
		DueDate: time.Now(),
		GrossAmount:  1500,
		Type:    "RENT",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p.Status)
	assert.Equal(t, leaseID, p.LeaseID)
}

func TestService_Create_LeaseIDNil(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		DueDate: time.Now(),
		GrossAmount:  1000,
		Type:    "RENT",
	})
	assert.Error(t, err)
}

func TestService_Create_AmountZero(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		LeaseID: uuid.New(),
		DueDate: time.Now(),
		Type:    "RENT",
	})
	assert.Error(t, err)
}

func TestService_Create_TypeInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		LeaseID: uuid.New(),
		DueDate: time.Now(),
		GrossAmount:  1000,
		Type:    "INVALIDO",
	})
	assert.Error(t, err)
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	found, err := svc.Get(context.Background(), p.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, p.ID, found.ID)
}

func TestService_ListByLease(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()
	leaseID := uuid.New()

	svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 500, Type: "DEPOSIT",
	})

	list, err := svc.ListByLease(context.Background(), leaseID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_StatusInválido(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	_, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "INVALIDO", GrossAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Update_MarcarPago(t *testing.T) {
	mock := newMockPaymentRepo()
	svc := payment.NewService(mock)
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	now := time.Now()
	updated, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "PAID", GrossAmount: 1000, PaidDate: &now,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", updated.Status)
	assert.NotNil(t, updated.PaidDate)
}

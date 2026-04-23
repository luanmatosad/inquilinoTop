package payment_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/tenant"
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
		ID:          uuid.New(),
		OwnerID:     ownerID,
		LeaseID:     in.LeaseID,
		DueDate:     in.DueDate,
		GrossAmount: in.GrossAmount,
		Type:        in.Type,
		Status:      "PENDING",
		Competency:  in.Competency,
		Description: in.Description,
	}
	m.payments[p.ID] = p
	return p, nil
}

func (m *mockPaymentRepo) CreateIfAbsent(_ context.Context, ownerID uuid.UUID, in payment.CreatePaymentInput) (*payment.Payment, bool, error) {
	for _, p := range m.payments {
		if p.LeaseID == in.LeaseID && p.Type == in.Type && p.Competency != nil && in.Competency != nil && *p.Competency == *in.Competency {
			return p, false, nil
		}
	}
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

func (m *mockPaymentRepo) UpdateChargeInfo(_ context.Context, id, ownerID uuid.UUID, in payment.UpdateChargeInfoInput) error {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return err
	}
	p.ChargeID = &in.ChargeID
	p.ChargeMethod = &in.ChargeMethod
	p.ChargeQRCode = &in.QRCode
	p.ChargeLink = &in.Link
	p.ChargeBarcode = &in.BarCode
	return nil
}

func (m *mockPaymentRepo) UpdatePayoutInfo(_ context.Context, id, ownerID uuid.UUID, payoutID, status string) error {
	p, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return err
	}
	p.PayoutID = &payoutID
	p.PayoutStatus = &status
	return nil
}

func (m *mockPaymentRepo) GetActiveFinancialConfig(_ context.Context, ownerID uuid.UUID) (*payment.FinancialConfig, error) {
	return nil, errors.New("not configured")
}

func (m *mockPaymentRepo) GetByChargeID(_ context.Context, chargeID string) (*payment.Payment, error) {
	for _, p := range m.payments {
		if p.ChargeID != nil && *p.ChargeID == chargeID {
			return p, nil
		}
	}
	return nil, errors.New("not found")
}

type mockLeaseReader struct {
	leases map[uuid.UUID]*lease.Lease
}

func newMockLeaseReader() *mockLeaseReader {
	return &mockLeaseReader{leases: make(map[uuid.UUID]*lease.Lease)}
}

func (m *mockLeaseReader) GetByID(_ context.Context, id, ownerID uuid.UUID) (*lease.Lease, error) {
	l, ok := m.leases[id]
	if !ok || l.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return l, nil
}

type mockTenantReader struct {
	tenants map[uuid.UUID]*tenant.Tenant
}

func newMockTenantReader() *mockTenantReader {
	return &mockTenantReader{tenants: make(map[uuid.UUID]*tenant.Tenant)}
}

func (m *mockTenantReader) GetByID(_ context.Context, id, ownerID uuid.UUID) (*tenant.Tenant, error) {
	t, ok := m.tenants[id]
	if !ok || t.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return t, nil
}

type mockIRRFTable struct {
	fixed float64
}

func (m *mockIRRFTable) Calculate(_ context.Context, base float64, _ time.Time) (float64, error) {
	return m.fixed, nil
}

type mockOwnerReader struct {
	owners map[uuid.UUID]*payment.OwnerSummary
}

func newMockOwnerReader() *mockOwnerReader {
	return &mockOwnerReader{owners: make(map[uuid.UUID]*payment.OwnerSummary)}
}

func (m *mockOwnerReader) GetByID(_ context.Context, id uuid.UUID) (*payment.OwnerSummary, error) {
	o, ok := m.owners[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return o, nil
}

type mockUnitReader struct {
	units map[uuid.UUID]*payment.UnitSummary
}

func newMockUnitReader() *mockUnitReader {
	return &mockUnitReader{units: make(map[uuid.UUID]*payment.UnitSummary)}
}

func (m *mockUnitReader) GetByID(_ context.Context, id, ownerID uuid.UUID) (*payment.UnitSummary, error) {
	u, ok := m.units[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (ts *testService) addLease(l *lease.Lease) {
	ts.leaseReader.leases[l.ID] = l
}

func (ts *testService) addOwner(o *payment.OwnerSummary) {
	ts.ownerReader.owners[o.ID] = o
}

func (ts *testService) addUnit(u *payment.UnitSummary) {
	ts.unitReader.units[u.ID] = u
}

type testService struct {
	*payment.Service
	leaseReader  *mockLeaseReader
	tenantReader *mockTenantReader
	unitReader   *mockUnitReader
	ownerReader  *mockOwnerReader
	repo         payment.Repository
}

func (ts *testService) addTenant(t *tenant.Tenant) {
	ts.tenantReader.tenants[t.ID] = t
}

func newTestService() *testService {
	repo := newMockPaymentRepo()
	lr := newMockLeaseReader()
	tr := newMockTenantReader()
	ur := newMockUnitReader()
	ow := newMockOwnerReader()
	irrf := &mockIRRFTable{}
	svc := payment.NewService(repo, lr, tr, ur, ow, irrf)
	return &testService{Service: svc, leaseReader: lr, tenantReader: tr, unitReader: ur, ownerReader: ow, repo: repo}
}

func setupLease(svc *testService, leaseID, ownerID uuid.UUID, lateFeePercent, dailyInterestPercent float64) {
	tenantID := uuid.New()
	l := &lease.Lease{
		ID:                   leaseID,
		OwnerID:              ownerID,
		TenantID:             tenantID,
		StartDate:            time.Now().AddDate(0, -6, 0),
		RentAmount:           2000,
		Status:               "ACTIVE",
		LateFeePercent:       lateFeePercent,
		DailyInterestPercent: dailyInterestPercent,
	}
	svc.leaseReader.leases[leaseID] = l

	t := &tenant.Tenant{
		ID:         tenantID,
		OwnerID:    ownerID,
		Name:       "Tenant Test",
		PersonType: "PF",
	}
	svc.addTenant(t)
}

func setupLeaseBasic(svc *testService, leaseID, ownerID uuid.UUID, rentAmount float64, startDate time.Time, iptuReimbursable bool, annualIPTU float64) {
	l := &lease.Lease{
		ID:                   leaseID,
		OwnerID:              ownerID,
		TenantID:             uuid.New(),
		StartDate:            startDate,
		RentAmount:           rentAmount,
		Status:               "ACTIVE",
		LateFeePercent:       0.10,
		DailyInterestPercent: 0.001,
		IPTUReimbursable:     iptuReimbursable,
	}
	if annualIPTU > 0 {
		l.AnnualIPTUAmount = &annualIPTU
	}
	svc.leaseReader.leases[leaseID] = l
}

func setupLeaseEnded(svc *testService, leaseID, ownerID uuid.UUID) {
	l := &lease.Lease{
		ID:         leaseID,
		OwnerID:    ownerID,
		TenantID:   uuid.New(),
		StartDate:  time.Now().AddDate(0, -6, 0),
		RentAmount: 2000,
		Status:     "ENDED",
	}
	svc.leaseReader.leases[leaseID] = l
}

func setupLeaseIPTUMissing(svc *testService, leaseID, ownerID uuid.UUID) {
	l := &lease.Lease{
		ID:               leaseID,
		OwnerID:          ownerID,
		TenantID:         uuid.New(),
		StartDate:        time.Now().AddDate(0, -6, 0),
		RentAmount:       2000,
		Status:           "ACTIVE",
		IPTUReimbursable: true,
	}
	svc.leaseReader.leases[leaseID] = l
}

func TestService_Create_Válido(t *testing.T) {
	svc := newTestService()
	ownerID := uuid.New()
	leaseID := uuid.New()

	p, err := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID:     leaseID,
		DueDate:     time.Now(),
		GrossAmount: 1500,
		Type:        "RENT",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p.Status)
	assert.Equal(t, leaseID, p.LeaseID)
}

func TestService_Create_LeaseIDNil(t *testing.T) {
	svc := newTestService()
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		DueDate:     time.Now(),
		GrossAmount: 1000,
		Type:        "RENT",
	})
	assert.Error(t, err)
}

func TestService_Create_AmountZero(t *testing.T) {
	svc := newTestService()
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		LeaseID: uuid.New(),
		DueDate: time.Now(),
		Type:    "RENT",
	})
	assert.Error(t, err)
}

func TestService_Create_TypeInválido(t *testing.T) {
	svc := newTestService()
	_, err := svc.Create(context.Background(), uuid.New(), payment.CreatePaymentInput{
		LeaseID:     uuid.New(),
		DueDate:     time.Now(),
		GrossAmount: 1000,
		Type:        "INVALIDO",
	})
	assert.Error(t, err)
}

func TestService_Get_Encontrado(t *testing.T) {
	svc := newTestService()
	ownerID := uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	found, err := svc.Get(context.Background(), p.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, p.ID, found.ID)
}

func TestService_ListByLease(t *testing.T) {
	svc := newTestService()
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
	svc := newTestService()
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
	svc := newTestService()
	ownerID := uuid.New()
	leaseID := uuid.New()
	setupLease(svc, leaseID, ownerID, 0.10, 0.001)

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	now := time.Now()
	updated, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "PAID", GrossAmount: 1000, PaidDate: &now,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", updated.Status)
	assert.NotNil(t, updated.PaidDate)
}

func TestService_Enrich_NãoAtrasado(t *testing.T) {
	svc := newTestService()
	leaseID := uuid.New()
	ownerID := uuid.New()
	setupLease(svc, leaseID, ownerID, 0.10, 0.000333)

	p := payment.Payment{
		LeaseID: leaseID, OwnerID: ownerID,
		DueDate: time.Now().AddDate(0, 0, 5), GrossAmount: 2000, Status: "PENDING", Type: "RENT",
	}
	out := svc.Enrich(context.Background(), p)
	assert.InDelta(t, 0, out.LateFeeAmount, 0.01)
	assert.InDelta(t, 0, out.InterestAmount, 0.01)
	assert.Equal(t, "PENDING", out.Status)
}

func TestService_Enrich_Atrasado(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLease(svc, leaseID, ownerID, 0.10, 0.001)

	p := payment.Payment{
		LeaseID: leaseID, OwnerID: ownerID,
		DueDate: time.Now().AddDate(0, 0, -10), GrossAmount: 2000, Status: "PENDING", Type: "RENT",
	}
	out := svc.Enrich(context.Background(), p)
	assert.InDelta(t, 200, out.LateFeeAmount, 0.01)
	assert.InDelta(t, 20, out.InterestAmount, 0.5)
	assert.Equal(t, "LATE", out.Status)
}

func TestService_GenerateMonth_RentESemIPTU(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), false, 0)

	ps, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.NoError(t, err)
	require.Len(t, ps, 1)
	assert.Equal(t, "RENT", ps[0].Type)
	assert.Equal(t, "2026-04", *ps[0].Competency)
	assert.Equal(t, 15, ps[0].DueDate.Day())
}

func TestService_GenerateMonth_ComIPTU(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), true, 1800)

	ps, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.NoError(t, err)
	require.Len(t, ps, 2)
	var iptu *payment.Payment
	for i, p := range ps {
		if p.Type == "EXPENSE" {
			iptu = &ps[i]
		}
	}
	require.NotNil(t, iptu)
	assert.InDelta(t, 150.0, iptu.GrossAmount, 0.01)
}

func TestService_GenerateMonth_Idempotente(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), false, 0)

	ps1, _ := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	ps2, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.NoError(t, err)
	assert.Equal(t, ps1[0].ID, ps2[0].ID)
}

func TestService_GenerateMonth_LeaseEnded(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseEnded(svc, leaseID, ownerID)

	_, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not active")
}

func TestService_GenerateMonth_MonthForaRange(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC), false, 0)

	_, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2025-01")
	require.Error(t, err)
}

func TestService_GenerateMonth_IPTUMissing(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseIPTUMissing(svc, leaseID, ownerID)

	_, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-04")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "iptu")
}

func TestService_GenerateMonth_DiaInexistenteNoMes(t *testing.T) {
	svc := newTestService()
	leaseID, ownerID := uuid.New(), uuid.New()
	setupLeaseBasic(svc, leaseID, ownerID, 2000, time.Date(2026, 1, 31, 0, 0, 0, 0, time.UTC), false, 0)

	ps, err := svc.GenerateMonth(context.Background(), leaseID, ownerID, "2026-02")
	require.NoError(t, err)
	assert.Equal(t, 28, ps[0].DueDate.Day())
}

func ptr[T any](v T) *T {
	return &v
}

func TestService_BuildReceipt_Pago(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID, unitID := uuid.New(), uuid.New(), uuid.New()
	tenantID := uuid.New()

	l := &lease.Lease{
		ID:         leaseID,
		OwnerID:    ownerID,
		TenantID:   tenantID,
		UnitID:     unitID,
		StartDate:  time.Now().AddDate(0, -6, 0),
		RentAmount: 2000,
		Status:     "ACTIVE",
	}
	svc.addLease(l)

	tn := &tenant.Tenant{
		ID:         tenantID,
		OwnerID:    ownerID,
		Name:       "Tenant Test",
		Document:   ptr("12345678900"),
		PersonType: "PF",
	}
	svc.addTenant(tn)

	doc := ptr("98765432100")
	ow := &payment.OwnerSummary{
		ID:       ownerID,
		Name:     "Owner Test",
		Document: doc,
	}
	svc.addOwner(ow)

	label := ptr("Apto 101")
	addr := ptr("Rua Test")
	un := &payment.UnitSummary{
		ID:               unitID,
		Label:            label,
		PropertyAddress:  addr,
	}
	svc.addUnit(un)

	paidDate := time.Now()
	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})
	svc.repo.(*mockPaymentRepo).MarkPaid(context.Background(), p.ID, ownerID, paidDate, 0, 0, 0, 2000)

	rec, err := svc.BuildReceipt(context.Background(), p.ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, 2000.0, rec.Amounts.Gross)
}

func TestService_BuildReceipt_NãoPago(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})

	_, err := svc.BuildReceipt(context.Background(), p.ID, ownerID)
	require.Error(t, err)
}

func TestService_BuildReceipt_NãoEncontrado(t *testing.T) {
	svc := newTestService()
	ownerID := uuid.New()

	_, err := svc.BuildReceipt(context.Background(), uuid.New(), ownerID)
	require.Error(t, err)
}

func TestService_Update_PaidDateVazio(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})

	updated, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "PENDING",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", updated.Status)
}

func TestService_Update_StatusInválidoNaCriação(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})

	_, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "INVALIDO",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "status")
}

func TestService_MarkPaid_PagoAnteriormente(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()
	setupLease(svc, leaseID, ownerID, 0.1, 0.001)

	tenantID := uuid.New()
	tn := &tenant.Tenant{
		ID: tenantID, OwnerID: ownerID, Name: "Tenant", PersonType: "PF",
	}
	svc.addTenant(tn)

	l := svc.leaseReader.leases[leaseID]
	l.TenantID = tenantID

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})

	svc.repo.MarkPaid(context.Background(), p.ID, ownerID, time.Now(), 0, 0, 0, 2000)

	_, err := svc.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		Status: "PAID", PaidDate: ptr(time.Now()),
	})
	require.Error(t, err)
	assert.True(t, svc.IsAlreadyPaid(err))
}

func TestService_CreateIfAbsent_JáExiste(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()
	month := "2026-01"

	p, created, _ := svc.repo.CreateIfAbsent(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT", Competency: &month,
	})
	require.True(t, created)

	p2, created2, err := svc.repo.CreateIfAbsent(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT", Competency: &month,
	})
	require.NoError(t, err)
	require.False(t, created2)
	assert.Equal(t, p.ID, p2.ID)
}

func TestService_CreateIfAbsent_Novo(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()
	month1 := "2026-01"
	month2 := "2026-02"

	_, created1, _ := svc.repo.CreateIfAbsent(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT", Competency: &month1,
	})
	require.True(t, created1)

	_, created2, err := svc.repo.CreateIfAbsent(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT", Competency: &month2,
	})
	require.NoError(t, err)
	require.True(t, created2)
}

func TestService_ProcessWebhook_PaymentRecebido(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})

	chargeID := "charge-123"
	svc.repo.(*mockPaymentRepo).payments[p.ID].ChargeID = &chargeID

	err := svc.ProcessWebhook(context.Background(), "mock", map[string]interface{}{
		"event":    "PAYMENT_RECEIVED",
		"chargeId": chargeID,
	})
	require.NoError(t, err)

	updated, _ := svc.Get(context.Background(), p.ID, ownerID)
	assert.Equal(t, "PAID", updated.Status)
}

func TestService_ProcessWebhook_EventInválido(t *testing.T) {
	svc := newTestService()

	err := svc.ProcessWebhook(context.Background(), "mock", map[string]interface{}{
		"event": "OUTRO_EVENT",
	})
	require.NoError(t, err)
}

func TestService_ProcessWebhook_SemEvent(t *testing.T) {
	svc := newTestService()

	err := svc.ProcessWebhook(context.Background(), "mock", map[string]interface{}{})
	require.Error(t, err)
}

func TestService_ProcessWebhook_ChargeIdInválido(t *testing.T) {
	svc := newTestService()

	err := svc.ProcessWebhook(context.Background(), "mock", map[string]interface{}{
		"event": "PAYMENT_RECEIVED",
	})
	require.Error(t, err)
}

func TestService_ProcessWebhook_PaymentNãoEncontrado(t *testing.T) {
	svc := newTestService()

	err := svc.ProcessWebhook(context.Background(), "mock", map[string]interface{}{
		"event":    "PAYMENT_RECEIVED",
		"chargeId": "inexistente",
	})
	require.Error(t, err)
}

func TestService_Enrich_PaymentPago(t *testing.T) {
	svc := newTestService()
	ownerID, leaseID := uuid.New(), uuid.New()

	p, _ := svc.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now().Add(-48 * time.Hour), GrossAmount: 2000, Type: "RENT",
	})

	paidDate := time.Now()
	svc.repo.MarkPaid(context.Background(), p.ID, ownerID, paidDate, 0, 0, 0, 2000)

	enriched := svc.Enrich(context.Background(), *p)
	assert.Equal(t, 0.0, enriched.LateFeeAmount)
}

func TestService_Enrich_LeaseNãoEncontrado(t *testing.T) {
	svc := newTestService()
	ownerID := uuid.New()

	p := payment.Payment{
		ID: uuid.New(), OwnerID: ownerID, LeaseID: uuid.New(),
		DueDate: time.Now().Add(-48 * time.Hour), GrossAmount: 2000, Type: "RENT", Status: "PENDING",
	}

	enriched := svc.Enrich(context.Background(), p)
	assert.Equal(t, "PENDING", enriched.Status)
}

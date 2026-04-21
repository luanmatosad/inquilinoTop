package fiscal_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockAggRepo struct {
	ownerName    string
	ownerErr     error
	leases       []fiscal.LeaseSummary
	payments     []fiscal.PaidPayment
	taxes        []fiscal.TaxExpense
}

func (m *mockAggRepo) GetOwner(_ context.Context, _ uuid.UUID) (*fiscal.ReportParty, error) {
	if m.ownerErr != nil {
		return nil, m.ownerErr
	}
	return &fiscal.ReportParty{Name: m.ownerName}, nil
}

func (m *mockAggRepo) ListOwnerLeases(_ context.Context, _ uuid.UUID) ([]fiscal.LeaseSummary, error) {
	return m.leases, nil
}

func (m *mockAggRepo) ListPaidPaymentsForYear(_ context.Context, _ uuid.UUID, _ int) ([]fiscal.PaidPayment, error) {
	return m.payments, nil
}

func (m *mockAggRepo) ListTaxExpensesPaidInYear(_ context.Context, _ uuid.UUID, _ int) ([]fiscal.TaxExpense, error) {
	return m.taxes, nil
}

func newFiscalTestService() *fiscal.Service {
	return fiscal.NewService(&mockAggRepo{})
}

func TestService_AnnualReport_SeparaPFePJ(t *testing.T) {
	ownerID := uuid.New()
	leasePFID := uuid.New()
	leasePJID := uuid.New()
	unit1ID := uuid.New()
	unit2ID := uuid.New()

	docPF := "12345678901"
	docPJ := "12345678000100"

	svc := fiscal.NewService(&mockAggRepo{
		ownerName: "Owner Test",
		leases: []fiscal.LeaseSummary{
			{
				LeaseID:          leasePFID,
				TenantID:         uuid.New(),
				TenantName:       "Tenant PF",
				TenantDocument:   &docPF,
				TenantPersonType: "PF",
				UnitID:           unit1ID,
				UnitLabel:        func() *string { s := "Unit 1"; return &s }(),
			},
			{
				LeaseID:          leasePJID,
				TenantID:         uuid.New(),
				TenantName:       "Tenant PJ",
				TenantDocument:   &docPJ,
				TenantPersonType: "PJ",
				UnitID:           unit2ID,
				UnitLabel:        func() *string { s := "Unit 2"; return &s }(),
			},
		},
		payments: []fiscal.PaidPayment{
			{PaymentID: uuid.New(), LeaseID: leasePFID, Competency: "2026-01", GrossAmount: 1000, LateFeeAmount: 0, InterestAmount: 0, IRRFAmount: 0, NetAmount: 1000, Type: "RENT"},
			{PaymentID: uuid.New(), LeaseID: leasePFID, Competency: "2026-02", GrossAmount: 1000, LateFeeAmount: 0, InterestAmount: 0, IRRFAmount: 0, NetAmount: 1000, Type: "RENT"},
			{PaymentID: uuid.New(), LeaseID: leasePJID, Competency: "2026-01", GrossAmount: 2000, LateFeeAmount: 0, InterestAmount: 0, IRRFAmount: 100, NetAmount: 1900, Type: "RENT"},
			{PaymentID: uuid.New(), LeaseID: leasePJID, Competency: "2026-02", GrossAmount: 2000, LateFeeAmount: 0, InterestAmount: 0, IRRFAmount: 100, NetAmount: 1900, Type: "RENT"},
		},
		taxes: []fiscal.TaxExpense{},
	})

	rep, err := svc.AnnualReport(context.Background(), ownerID, 2026)
	require.NoError(t, err)
	require.Len(t, rep.Leases, 2)
	assert.Equal(t, 2026, rep.Year)

	assert.InDelta(t, 2000.0, rep.Totals.ReceivedFromPF, 0.01)
	assert.InDelta(t, 4000.0, rep.Totals.ReceivedFromPJ, 0.01)
	assert.InDelta(t, 200.0, rep.Totals.TotalIRRFCredit, 0.01)
}

func TestService_AnnualReport_AnoVazio(t *testing.T) {
	svc := newFiscalTestService()
	rep, err := svc.AnnualReport(context.Background(), uuid.New(), 2099)
	require.NoError(t, err)
	assert.Len(t, rep.Leases, 0)
	assert.Zero(t, rep.Totals.ReceivedFromPF)
	assert.Zero(t, rep.Totals.ReceivedFromPJ)
}

func TestService_AnnualReport_YearInválido(t *testing.T) {
	svc := newFiscalTestService()
	_, err := svc.AnnualReport(context.Background(), uuid.New(), 1800)
	assert.Error(t, err)

	_, err = svc.AnnualReport(context.Background(), uuid.New(), 3000)
	assert.Error(t, err)
}

func TestService_AnnualReport_ComIPTU(t *testing.T) {
	ownerID := uuid.New()
	leaseID := uuid.New()
	unitID := uuid.New()

	docPF := "12345678901"

	svc := fiscal.NewService(&mockAggRepo{
		ownerName: "Owner Test",
		leases: []fiscal.LeaseSummary{
			{
				LeaseID:          leaseID,
				TenantID:         uuid.New(),
				TenantName:       "Tenant PF",
				TenantDocument:   &docPF,
				TenantPersonType: "PF",
				UnitID:           unitID,
				UnitLabel:        func() *string { s := "Unit 1"; return &s }(),
			},
		},
		payments: []fiscal.PaidPayment{
			{PaymentID: uuid.New(), LeaseID: leaseID, Competency: "2026-01", GrossAmount: 1000, LateFeeAmount: 0, InterestAmount: 0, IRRFAmount: 0, NetAmount: 1000, Type: "RENT"},
		},
		taxes: []fiscal.TaxExpense{
			{UnitID: unitID, Amount: 500, PaidYear: 2026},
		},
	})

	rep, err := svc.AnnualReport(context.Background(), ownerID, 2026)
	require.NoError(t, err)
	require.Len(t, rep.Leases, 1)
	assert.InDelta(t, 500.0, rep.Totals.DeductibleIPTU, 0.01)
	assert.InDelta(t, 500.0, rep.Leases[0].DeductibleIPTUPaid, 0.01)
}

func TestService_AnnualReport_OwnerNãoEncontrado(t *testing.T) {
	svc := fiscal.NewService(&mockAggRepo{
		ownerErr: fiscal.ErrOwnerNotFound,
	})

	_, err := svc.AnnualReport(context.Background(), uuid.New(), 2026)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "owner não encontrado")
}
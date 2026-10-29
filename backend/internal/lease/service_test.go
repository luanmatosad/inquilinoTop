package lease_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestService_Create_Válido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, err := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1500,
		PaymentDay: 5,
	})
	require.NoError(t, err)
	assert.Equal(t, orgID, l.OrganizationID)
	assert.Equal(t, "ACTIVE", l.Status)
}

func TestService_Create_UnitIDNil(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()
	_, err := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Create_TenantIDNil(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()
	_, err := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Create_RentAmountZero(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()
	_, err := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID:    uuid.New(),
		TenantID:  uuid.New(),
		StartDate: time.Now(),
		RentAmount: 0,
	})
	assert.Error(t, err)
}

func TestService_Create_PaymentDayInválido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()
	_, err := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
		PaymentDay: 32,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "payment_day")
}

   func TestService_Create_PaymentDayVálido(t *testing.T) {
       mock := newMockLeaseRepo()
       svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
       orgID := uuid.New()
       ownerID := uuid.New()
       l, err := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
           UnitID:     uuid.New(),
           TenantID:   uuid.New(),
           StartDate:  time.Now(),
           RentAmount: 1000,
           PaymentDay: 15,
       })
       require.NoError(t, err)
       assert.Equal(t, 15, l.PaymentDay)
   }

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, _ := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000, PaymentDay: 5,
	})
	found, err := svc.Get(context.Background(), l.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, l.ID, found.ID)
}

func TestService_Get_NãoEncontrado(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo(), &mockIndexRepo{})
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_List(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 2000,
	})

	list, err := svc.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_StatusInválido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, _ := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	_, err := svc.Update(context.Background(), l.ID, orgID, lease.UpdateLeaseInput{
		Status: "INVALIDO", RentAmount: 1000,
	})
	assert.Error(t, err)
}

func TestService_Update_Válido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, _ := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	updated, err := svc.Update(context.Background(), l.ID, orgID, lease.UpdateLeaseInput{
		Status: "ACTIVE", RentAmount: 1500,
	})
	require.NoError(t, err)
	assert.Equal(t, float64(1500), updated.RentAmount)
}

func TestService_Delete(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, _ := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	err := svc.Delete(context.Background(), l.ID, orgID)
	require.NoError(t, err)

	list, _ := svc.List(context.Background(), orgID)
	assert.Len(t, list, 0)
}

func TestService_End(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, _ := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	ended, err := endLease(svc, l.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, "ENDED", ended.Status)
}

func TestService_Renew_Válido(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID := uuid.New()
	ownerID := uuid.New()

	l, _ := createLease(svc, orgID, ownerID, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now(), RentAmount: 1000,
	})
	newEnd := time.Now().Add(365 * 24 * time.Hour)
	renewed, err := svc.Renew(context.Background(), l.ID, orgID, lease.RenewLeaseInput{
		NewEndDate: newEnd, RentAmount: 1200,
	})
	require.NoError(t, err)
	assert.Equal(t, float64(1200), renewed.RentAmount)
}

func TestService_Renew_DataZero(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo(), &mockIndexRepo{})
	_, err := svc.Renew(context.Background(), uuid.New(), uuid.New(), lease.RenewLeaseInput{})
	assert.Error(t, err)
}

func TestService_Readjust_PercentagemInválida(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID, leaseID := uuid.New(), uuid.New()
	mock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OrganizationID: orgID, Status: "ACTIVE", RentAmount: 2000,
	}

	_, err := svc.Readjust(context.Background(), leaseID, orgID, lease.ReadjustInput{
		Percentage: 0, AppliedAt: time.Now(),
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, lease.ErrInvalidPercentage)
}

func TestService_Readjust_PercentagemMaiorQueUm(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID, leaseID := uuid.New(), uuid.New()
	mock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OrganizationID: orgID, Status: "ACTIVE", RentAmount: 2000,
	}

	_, err := svc.Readjust(context.Background(), leaseID, orgID, lease.ReadjustInput{
		Percentage: 1.5, AppliedAt: time.Now(),
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, lease.ErrInvalidPercentage)
}

func TestService_Readjust_LeaseNãoEncontrado(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo(), &mockIndexRepo{})
	_, err := svc.Readjust(context.Background(), uuid.New(), uuid.New(), lease.ReadjustInput{
		Percentage: 0.1, AppliedAt: time.Now(),
	})
	require.Error(t, err)
}

func TestService_Readjust_LeaseInativo(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID, leaseID := uuid.New(), uuid.New()
	mock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OrganizationID: orgID, Status: "ENDED", RentAmount: 2000,
	}

	_, err := svc.Readjust(context.Background(), leaseID, orgID, lease.ReadjustInput{
		Percentage: 0.1, AppliedAt: time.Now(),
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, lease.ErrLeaseNotActive)
}

func TestService_Readjust_Sucesso(t *testing.T) {
	mock := newMockLeaseRepo()
	svc := lease.NewService(mock, newMockReadjustmentRepo(), &mockIndexRepo{})
	orgID, leaseID := uuid.New(), uuid.New()
	mock.leases[leaseID] = &lease.Lease{
		ID: leaseID, OrganizationID: orgID, Status: "ACTIVE", RentAmount: 2000,
	}

	out, err := svc.Readjust(context.Background(), leaseID, orgID, lease.ReadjustInput{
		Percentage: 0.1, AppliedAt: time.Now(),
	})
	require.NoError(t, err)
	assert.Equal(t, 2200.0, out.Lease.RentAmount)
	assert.NotNil(t, out.Readjustment)
}

func TestService_ListReadjustments(t *testing.T) {
	mock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	svc := lease.NewService(mock, readjMock, &mockIndexRepo{})
	orgID, leaseID := uuid.New(), uuid.New()

	readjMock.items = append(readjMock.items, lease.Readjustment{
		LeaseID: leaseID, OrganizationID: orgID, Percentage: 0.1,
	})

	list, err := svc.ListReadjustments(context.Background(), leaseID, orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

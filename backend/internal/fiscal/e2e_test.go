//go:build integration

package fiscal_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users CASCADE")
		d.Close()
	})
	return d
}

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-e2e@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedUnitForOwner(t *testing.T, database *db.DB, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var propertyID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio E2E') RETURNING id`,
		ownerID,
	).Scan(&propertyID)
	require.NoError(t, err)

	var unitID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 101') RETURNING id`,
		propertyID,
	).Scan(&unitID)
	require.NoError(t, err)
	return unitID
}



func TestE2E_CicloFiscalCompleto(t *testing.T) {
	d := testDB(t)

	ownerID := seedUser(t, d)
	unitID := seedUnitForOwner(t, d, ownerID)

	pj := "PJ"
	tnRepo := tenant.NewRepository(d)
	tn, err := tnRepo.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name: "Empresa X", PersonType: &pj,
	})
	require.NoError(t, err)

	leaseRepo := lease.NewRepository(d)
	iptu := 1800.0
	year := 2026
	l, err := leaseRepo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tn.ID,
		StartDate: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC),
		RentAmount: 2500,
		LateFeePercent: 0.10, DailyInterestPercent: 0.001,
		IPTUReimbursable: true, AnnualIPTUAmount: &iptu, IPTUYear: &year,
	})
	require.NoError(t, err)

	bracketsRepo := fiscal.NewBracketsRepository(d)
	irrf := fiscal.NewIRRFTable(bracketsRepo)
	payRepo := payment.NewRepository(d)
	propRepo := property.NewRepository(d)
	identRepo := identity.NewRepository(d)
	unitAdapter := &payment.UnitReaderAdapter{Repo: propRepo}
	ownerAdapter := &payment.OwnerReaderAdapter{Repo: identRepo}

	paySvc := payment.NewService(payRepo, leaseRepo, tnRepo, unitAdapter, ownerAdapter, irrf)

	for _, m := range []string{"2026-01", "2026-02", "2026-03"} {
		_, err := paySvc.GenerateMonth(context.Background(), l.ID, ownerID, m)
		require.NoError(t, err)
	}

	list, err := paySvc.ListByLease(context.Background(), l.ID, ownerID)
	require.NoError(t, err)
	var rents []payment.Payment
	for _, p := range list {
		if p.Type == "RENT" {
			rents = append(rents, p)
		}
	}
	require.Len(t, rents, 3)

	paid1 := rents[0].DueDate
	upd := payment.UpdatePaymentInput{PaidDate: &paid1, Status: "PAID", GrossAmount: rents[0].GrossAmount}
	p1, err := paySvc.Update(context.Background(), rents[0].ID, ownerID, upd)
	require.NoError(t, err)
	assert.Greater(t, p1.IRRFAmount, 0.0)

	paid2 := rents[1].DueDate.AddDate(0, 0, 10)
	upd2 := payment.UpdatePaymentInput{PaidDate: &paid2, Status: "PAID", GrossAmount: rents[1].GrossAmount}
	p2, err := paySvc.Update(context.Background(), rents[1].ID, ownerID, upd2)
	require.NoError(t, err)
	assert.Greater(t, p2.LateFeeAmount, 0.0)
	assert.Greater(t, p2.InterestAmount, 0.0)

	p3, err := paySvc.Get(context.Background(), rents[2].ID, ownerID)
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p3.Status)

	aggRepo := fiscal.NewAggregateRepository(d)
	fiscalSvc := fiscal.NewService(aggRepo)
	rep, err := fiscalSvc.AnnualReport(context.Background(), ownerID, 2026)
	require.NoError(t, err)

	require.NotEmpty(t, rep.Leases)
	var target *fiscal.AnnualLeaseReport
	for i, lr := range rep.Leases {
		if lr.LeaseID == l.ID {
			target = &rep.Leases[i]
			break
		}
	}
	require.NotNil(t, target)
	assert.Equal(t, "PJ_WITHHELD", target.Category)
	assert.Greater(t, target.TotalIRRFWithheld, 0.0)
	assert.Greater(t, rep.Totals.ReceivedFromPJ, 0.0)
	assert.Equal(t, 0.0, rep.Totals.ReceivedFromPF)
}
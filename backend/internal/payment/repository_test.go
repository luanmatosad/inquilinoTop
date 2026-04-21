package payment_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@postgres_test:5432/inquilinotop_test?sslmode=disable"
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

func seedLease(t *testing.T, database *db.DB) (ownerID uuid.UUID, leaseID uuid.UUID) {
	t.Helper()
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-payment@test.com", "hash",
	).Scan(&ownerID)
	require.NoError(t, err)

	var propertyID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio') RETURNING id`,
		ownerID,
	).Scan(&propertyID)
	require.NoError(t, err)

	var unitID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 1') RETURNING id`,
		propertyID,
	).Scan(&unitID)
	require.NoError(t, err)

	var tenantID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, name) VALUES ($1, 'Inquilino') RETURNING id`,
		ownerID,
	).Scan(&tenantID)
	require.NoError(t, err)

	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO leases (owner_id, unit_id, tenant_id, start_date, rent_amount)
		 VALUES ($1, $2, $3, NOW(), 1000) RETURNING id`,
		ownerID, unitID, tenantID,
	).Scan(&leaseID)
	require.NoError(t, err)

	return ownerID, leaseID
}

func TestPaymentRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)

	p, err := repo.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID,
		DueDate: time.Now(),
		GrossAmount:  1000.00,
		Type:    "RENT",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p.Status)
	assert.Equal(t, "RENT", p.Type)

	list, err := repo.ListByLease(context.Background(), leaseID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestPaymentRepository_Update_MarkAsPaid(t *testing.T) {
	database := testDB(t)
	ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)

	p, _ := repo.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})

	now := time.Now()
	updated, err := repo.Update(context.Background(), p.ID, ownerID, payment.UpdatePaymentInput{
		PaidDate: &now,
		Status:   "PAID",
		GrossAmount:   1000,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", updated.Status)
	assert.NotNil(t, updated.PaidDate)
}

func TestRepository_CreateIfAbsent_Idempotente(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	ownerID, leaseID := seedLease(t, d)

	comp := "2026-04"
	in := payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
		Competency: &comp,
	}
	p1, created, err := repo.CreateIfAbsent(context.Background(), ownerID, in)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, p1)

	p2, created, err := repo.CreateIfAbsent(context.Background(), ownerID, in)
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, p1.ID, p2.ID)
}

func TestRepository_MarkPaid_PersisteCamposDerivados(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})
	require.NoError(t, err)

	paid, err := repo.MarkPaid(context.Background(), p.ID, ownerID, time.Now(),
		200, 30, 150, 2080)
	require.NoError(t, err)
	assert.Equal(t, "PAID", paid.Status)
	assert.InDelta(t, 200, paid.LateFeeAmount, 0.01)
	assert.InDelta(t, 30,  paid.InterestAmount, 0.01)
	assert.InDelta(t, 150, paid.IRRFAmount, 0.01)
	require.NotNil(t, paid.NetAmount)
	assert.InDelta(t, 2080, *paid.NetAmount, 0.01)
}

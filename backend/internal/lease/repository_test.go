package lease_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
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
		"owner-lease@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedProperty(t *testing.T, database *db.DB, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio Teste') RETURNING id`,
		ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedUnit(t *testing.T, database *db.DB, propertyID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 101') RETURNING id`,
		propertyID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedTenant(t *testing.T, database *db.DB, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, name) VALUES ($1, 'Inquilino Teste') RETURNING id`,
		ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestLeaseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	propertyID := seedProperty(t, database, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, ownerID)
	repo := lease.NewRepository(database)

	l, err := repo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID:     unitID,
		TenantID:   tenantID,
		StartDate:  time.Now(),
		RentAmount: 1500.00,
		PaymentDay: 5,
	})
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", l.Status)
	assert.Equal(t, 1500.00, l.RentAmount)

	list, err := repo.List(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestLeaseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	propertyID := seedProperty(t, database, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})
	err := repo.Delete(context.Background(), l.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.List(context.Background(), ownerID)
	assert.Len(t, list, 0)
}

func TestLeaseRepository_Update(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	propertyID := seedProperty(t, database, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(context.Background(), ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})

	updated, err := repo.Update(context.Background(), l.ID, ownerID, lease.UpdateLeaseInput{
		RentAmount: 1200,
		Status:     "ENDED",
	})
	require.NoError(t, err)
	assert.Equal(t, 1200.00, updated.RentAmount)
	assert.Equal(t, "ENDED", updated.Status)
}

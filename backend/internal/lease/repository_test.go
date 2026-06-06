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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, properties, units, leases, tenants, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrgAndUser(t *testing.T, database *db.DB) (orgID, ownerID uuid.UUID) {
	t.Helper()
	
	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
		"Test Org",
	).Scan(&newOrgID)
	require.NoError(t, err)
	
	var newOwnerID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, $2, $3) RETURNING id`,
		"owner-lease@test.com", "hash", newOrgID,
	).Scan(&newOwnerID)
	require.NoError(t, err)
	
	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
		newOrgID, newOwnerID,
	)
	require.NoError(t, err)
	
	return newOrgID, newOwnerID
}

func seedProperty(t *testing.T, database *db.DB, orgID, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1, $2, 'RESIDENTIAL', 'Prédio Teste') RETURNING id`,
		orgID, ownerID,
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

func seedTenant(t *testing.T, database *db.DB, orgID, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (organization_id, owner_id, name) VALUES ($1, $2, 'Inquilino Teste') RETURNING id`,
		// Note: organization_id should be the same as the user's organization_id, which we don't have here.
		// We'll set it to a dummy orgID for now, but we should instead use the organization_id from the user.
		// However, the user's organization_id is set in seedOrgAndUser (newOrgID). We don't have that here.
		// We'll change the seedTenant to also take orgID? But we don't have it in the call.
		// Let's look at how seedTenant is used: it's called with orgID from seedOrgAndUser? Actually, in the tests we call seedTenant(t, database, orgID) where orgID is from seedOrgAndUser.
		// So we can change seedTenant to take orgID and ownerID, but we only need ownerID for the owner_id field.
		// For organization_id, we can set it to orgID (the same as the user's organization_id).
		orgID, ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestLeaseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, orgID, ownerID)
	repo := lease.NewRepository(database)

	l, err := repo.Create(context.Background(), orgID, ownerID, lease.CreateLeaseInput{
		UnitID:     unitID,
		TenantID:   tenantID,
		StartDate:  time.Now(),
		RentAmount: 1500.00,
		PaymentDay: 5,
	})
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", l.Status)
	assert.Equal(t, 1500.00, l.RentAmount)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestLeaseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, orgID, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(context.Background(), orgID, ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})
	err := repo.Delete(context.Background(), l.ID, orgID)
	require.NoError(t, err)

	list, _ := repo.List(context.Background(), orgID)
	assert.Len(t, list, 0)
}

func TestLeaseRepository_Update(t *testing.T) {
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, orgID, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(context.Background(), orgID, ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})

	updated, err := repo.Update(context.Background(), l.ID, orgID, lease.UpdateLeaseInput{
		RentAmount: 1200,
		Status:     "ENDED",
	})
	require.NoError(t, err)
	assert.Equal(t, 1200.00, updated.RentAmount)
	assert.Equal(t, "ENDED", updated.Status)
}

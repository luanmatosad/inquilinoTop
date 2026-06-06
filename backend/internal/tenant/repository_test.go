package tenant_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, tenants, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrgAndUser(t *testing.T, database *db.DB) (orgID, userID uuid.UUID) {
	t.Helper()

	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (id, name) VALUES (gen_random_uuid(), $1) RETURNING id`,
		"Test Org "+uuid.New().String()[:8],
	).Scan(&newOrgID)
	require.NoError(t, err)

	var newUserID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (id, email, password_hash, organization_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
		"tenant-"+uuid.New().String()[:8]+"@test.com", "hash", newOrgID,
	).Scan(&newUserID)
	require.NoError(t, err)

	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (gen_random_uuid(), $1, $2, 'owner')`,
		newOrgID, newUserID,
	)
	require.NoError(t, err)

	return newOrgID, newUserID
}

func TestTenantRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)

	email := "joao@example.com"
	ten, err := repo.Create(context.Background(), userID, orgID, tenant.CreateTenantInput{Name: "João Silva", Email: &email})
	require.NoError(t, err)
	assert.Equal(t, "João Silva", ten.Name)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestTenantRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)

	ten, err := repo.Create(context.Background(), userID, orgID, tenant.CreateTenantInput{Name: "Maria"})
	require.NoError(t, err)
	require.NotNil(t, ten)
	err = repo.Delete(context.Background(), ten.ID, orgID)
	require.NoError(t, err)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 0)
}

func TestRepository_Create_PersonTypePJ(t *testing.T) {
	d := testDB(t)
	orgID, userID := seedOrgAndUser(t, d)
	repo := tenant.NewRepository(d)

	pt := "PJ"
	tn, err := repo.Create(context.Background(), userID, orgID, tenant.CreateTenantInput{
		Name:       "Empresa X",
		PersonType: &pt,
	})
	require.NoError(t, err)
	assert.Equal(t, "PJ", tn.PersonType)

	_ = userID // suppress unused warning
	got, err := repo.GetByID(context.Background(), tn.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, "PJ", got.PersonType)
}

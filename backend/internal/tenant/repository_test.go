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
		d.Pool.Exec(context.Background(), "TRUNCATE users, tenants CASCADE")
		d.Close()
	})
	return d
}

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-tenant@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestTenantRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := tenant.NewRepository(database)

	email := "joao@example.com"
	ten, err := repo.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "João Silva", Email: &email})
	require.NoError(t, err)
	assert.Equal(t, "João Silva", ten.Name)

	list, err := repo.List(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestTenantRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := tenant.NewRepository(database)

	ten, _ := repo.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "Maria"})
	err := repo.Delete(context.Background(), ten.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.List(context.Background(), ownerID)
	assert.Len(t, list, 0)
}

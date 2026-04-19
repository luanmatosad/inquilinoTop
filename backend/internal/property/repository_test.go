package property_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
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
		d.Pool.Exec(context.Background(), "TRUNCATE users, properties, units, tenants CASCADE")
		d.Close()
	})
	return d
}

func seedUser(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner@test.com", "hash",
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestRepository_CreateAndListProperties(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := property.NewRepository(database)

	name := "Edificio Central"
	p, err := repo.Create(ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: name})
	require.NoError(t, err)
	assert.Equal(t, name, p.Name)
	assert.Equal(t, ownerID, p.OwnerID)

	list, err := repo.List(ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestRepository_DeleteProperty_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(ownerID, property.CreatePropertyInput{Type: "SINGLE", Name: "Casa"})
	err := repo.Delete(p.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.List(ownerID)
	assert.Len(t, list, 0)
}

func TestRepository_CreateUnit(t *testing.T) {
	database := testDB(t)
	ownerID := seedUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	unit, err := repo.CreateUnit(p.ID, property.CreateUnitInput{Label: "Apt 101"})
	require.NoError(t, err)
	assert.Equal(t, "Apt 101", unit.Label)
}

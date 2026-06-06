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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, properties, units, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrgAndUser(t *testing.T, database *db.DB) (orgID, userID uuid.UUID) {
	t.Helper()

	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
		"Test Org",
	).Scan(&newOrgID)
	require.NoError(t, err)

	var newUserID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, $2, $3) RETURNING id`,
		"owner@test.com", "hash", newOrgID,
	).Scan(&newUserID)
	require.NoError(t, err)

	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
		newOrgID, newUserID,
	)
	require.NoError(t, err)

	return newOrgID, newUserID
}

func TestRepository_CreateAndListProperties(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	name := "Edificio Central"
	p, err := repo.Create(context.Background(), userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: name})
	require.NoError(t, err)
	assert.Equal(t, name, p.Name)
	assert.Equal(t, orgID, p.OrganizationID)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestRepository_DeleteProperty_SoftDelete(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(context.Background(), userID, orgID, property.CreatePropertyInput{Type: "SINGLE", Name: "Casa"})
	err := repo.Delete(context.Background(), p.ID, orgID)
	require.NoError(t, err)

	list, _ := repo.List(context.Background(), orgID)
	assert.Len(t, list, 0)
}

func TestRepository_CreateUnit(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(context.Background(), userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	unit, err := repo.CreateUnit(context.Background(), p.ID, property.CreateUnitInput{Label: "Apt 101"})
	require.NoError(t, err)
	assert.Equal(t, "Apt 101", unit.Label)
}

package expense_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
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

func seedUnit(t *testing.T, database *db.DB) (ownerID uuid.UUID, unitID uuid.UUID) {
	t.Helper()
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		"owner-expense@test.com", "hash",
	).Scan(&ownerID)
	require.NoError(t, err)

	var propertyID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, type, name) VALUES ($1, 'RESIDENTIAL', 'Prédio') RETURNING id`,
		ownerID,
	).Scan(&propertyID)
	require.NoError(t, err)

	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 1') RETURNING id`,
		propertyID,
	).Scan(&unitID)
	require.NoError(t, err)

	return ownerID, unitID
}

func TestExpenseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	ownerID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)

	e, err := repo.Create(ownerID, expense.CreateExpenseInput{
		UnitID:      unitID,
		Description: "Conta de água",
		Amount:      150.00,
		DueDate:     time.Now(),
		Category:    "WATER",
	})
	require.NoError(t, err)
	assert.Equal(t, "WATER", e.Category)
	assert.Equal(t, 150.00, e.Amount)

	list, err := repo.ListByUnit(unitID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestExpenseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	ownerID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)

	e, _ := repo.Create(ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Energia", Amount: 200, DueDate: time.Now(), Category: "ELECTRICITY",
	})
	err := repo.Delete(e.ID, ownerID)
	require.NoError(t, err)

	list, _ := repo.ListByUnit(unitID, ownerID)
	assert.Len(t, list, 0)
}

package audit_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/audit"
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
		d.Pool.Exec(context.Background(), "TRUNCATE audit_logs CASCADE")
		d.Close()
	})
	return d
}

func TestRepository_List_WithAllFilters(t *testing.T) {
	d := testDB(t)
	repo := audit.NewRepository(d.Pool)
	ownerID := uuid.New()

	_, _ = d.Pool.Exec(context.Background(),
		`INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)`,
		ownerID, "audit@test.com", "hash",
	)

	now := time.Now().UTC()
	eventType := "LOGIN"
	entityType := "user"

	_, err := repo.Create(context.Background(), ownerID, audit.CreateInput{
		EventType:  eventType,
		EntityType: &entityType,
	})
	require.NoError(t, err)

	from := now.Add(-time.Minute)
	to := now.Add(time.Minute)

	logs, err := repo.List(context.Background(), ownerID, &from, &to, &eventType)
	require.NoError(t, err, "List com 3 filtros não deve retornar erro de SQL")
	assert.Len(t, logs, 1)
}
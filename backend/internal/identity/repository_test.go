package identity_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/identity"
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
		d.Pool.Exec(context.Background(), "TRUNCATE users, refresh_tokens CASCADE")
		d.Close()
	})
	return d
}

func TestRepository_CreateAndGetUser(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, err := repo.CreateUser(context.Background(), "test@example.com", "hash123")
	require.NoError(t, err)
	assert.NotEmpty(t, user.ID)
	assert.Equal(t, "test@example.com", user.Email)

	found, err := repo.GetUserByEmail(context.Background(), "test@example.com")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.ID)
}

func TestRepository_CreateRefreshToken(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, _ := repo.CreateUser(context.Background(), "rt@example.com", "hash")
	rt, err := repo.CreateRefreshToken(context.Background(), user.ID, "tokenHash123", time.Now().Add(30*24*time.Hour))
	require.NoError(t, err)
	assert.NotEmpty(t, rt.ID)

	found, err := repo.GetRefreshToken(context.Background(), "tokenHash123")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.UserID)
}

func TestRepository_RevokeRefreshToken(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, _ := repo.CreateUser(context.Background(), "rev@example.com", "hash")
	repo.CreateRefreshToken(context.Background(), user.ID, "revokeMe", time.Now().Add(time.Hour))

	err := repo.RevokeRefreshToken(context.Background(), "revokeMe")
	require.NoError(t, err)

	rt, _ := repo.GetRefreshToken(context.Background(), "revokeMe")
	assert.NotNil(t, rt.RevokedAt)
}

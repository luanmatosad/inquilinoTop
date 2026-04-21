package fiscal_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/fiscal"
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
	t.Cleanup(func() { d.Close() })
	return d
}

func TestBracketsRepository_Seed2024(t *testing.T) {
	d := testDB(t)
	repo := fiscal.NewBracketsRepository(d)
	at, _ := time.Parse("2006-01-02", "2026-04-15")
	bs, err := repo.ActiveBrackets(context.Background(), at)
	require.NoError(t, err)
	assert.Len(t, bs, 5)
	assert.InDelta(t, 0.275, bs[len(bs)-1].Rate, 0.0001)
}

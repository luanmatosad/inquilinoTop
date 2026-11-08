package closing_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/closing"
	"github.com/inquilinotop/api/pkg/apierr"
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
		d.Pool.Exec(context.Background(), "TRUNCATE month_closing_events, month_closings, organization_members, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrg(t *testing.T, d *db.DB) (orgID, userID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+uuid.New().String()[:8]).Scan(&orgID))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, 'hash', $2) RETURNING id`,
		"closing-"+uuid.New().String()[:8]+"@test.com", orgID).Scan(&userID))
	return orgID, userID
}

func newClosing(org, user uuid.UUID, month string) (closing.Closing, closing.Event) {
	id := uuid.New()
	at := time.Now()
	c := closing.Closing{
		ID: id, OrganizationID: org, Month: month, ClosedAt: &at, ClosedBy: &user, ClosedByName: "Luan",
		Snapshot: closing.Snapshot{
			Forecast: closing.Bucket{Count: 5, Total: 8300}, Received: closing.Bucket{Count: 4, Total: 6750},
			Overdue: closing.Bucket{Count: 1, Total: 1550}, ReceiptsIssued: 4,
			Pending: []closing.Pending{{PaymentID: uuid.New(), Tenant: "Bruno", Amount: 1550, DueDate: "2026-10-05"}},
		},
	}
	e := closing.Event{ID: uuid.New(), OrganizationID: org, Month: month, ClosingID: id, Kind: closing.EventClosed, ActorID: &user, ActorName: "Luan", CreatedAt: at}
	return c, e
}

func TestRepository_CloseEGetActive(t *testing.T) {
	d := testDB(t)
	repo := closing.NewRepository(d)
	org, user := seedOrg(t, d)
	ctx := context.Background()

	_, err := repo.GetActive(ctx, org, "2026-10")
	assert.ErrorIs(t, err, apierr.ErrNotFound)

	c, e := newClosing(org, user, "2026-10")
	require.NoError(t, repo.Close(ctx, c, e))

	got, err := repo.GetActive(ctx, org, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, c.ID, got.ID)
	assert.Equal(t, "Luan", got.ClosedByName)
	assert.Equal(t, 5, got.Snapshot.Forecast.Count)
	require.Len(t, got.Snapshot.Pending, 1)
	assert.Equal(t, "Bruno", got.Snapshot.Pending[0].Tenant)
}

func TestRepository_Close_Duplicado(t *testing.T) {
	d := testDB(t)
	repo := closing.NewRepository(d)
	org, user := seedOrg(t, d)
	c, e := newClosing(org, user, "2026-10")
	require.NoError(t, repo.Close(context.Background(), c, e))
	c2, e2 := newClosing(org, user, "2026-10")
	assert.ErrorIs(t, repo.Close(context.Background(), c2, e2), closing.ErrAlreadyClosed)
}

func TestRepository_Reopen_SemDeleteEFechaDeNovo(t *testing.T) {
	d := testDB(t)
	repo := closing.NewRepository(d)
	org, user := seedOrg(t, d)
	ctx := context.Background()

	reopen := closing.Event{ID: uuid.New(), OrganizationID: org, Month: "2026-10", Kind: closing.EventReopened, ActorID: &user, ActorName: "Luan", CreatedAt: time.Now()}
	assert.ErrorIs(t, repo.Reopen(ctx, org, "2026-10", reopen), closing.ErrNotClosed)

	c, e := newClosing(org, user, "2026-10")
	require.NoError(t, repo.Close(ctx, c, e))

	reason := "corrigir baixa"
	reopen.Reason = &reason
	require.NoError(t, repo.Reopen(ctx, org, "2026-10", reopen))
	_, err := repo.GetActive(ctx, org, "2026-10")
	assert.ErrorIs(t, err, apierr.ErrNotFound)

	var rows int
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM month_closings WHERE organization_id=$1`, org).Scan(&rows))
	assert.Equal(t, 1, rows, "reabrir desativa, não apaga")

	c2, e2 := newClosing(org, user, "2026-10")
	require.NoError(t, repo.Close(ctx, c2, e2))

	events, err := repo.Events(ctx, org, "2026-10")
	require.NoError(t, err)
	require.Len(t, events, 3)
	assert.Equal(t, []string{"CLOSED", "REOPENED", "CLOSED"}, []string{events[0].Kind, events[1].Kind, events[2].Kind})
	require.NotNil(t, events[1].Reason)
	assert.Equal(t, "corrigir baixa", *events[1].Reason)
}

func TestRepository_IsolamentoPorOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := closing.NewRepository(d)
	orgA, userA := seedOrg(t, d)
	orgB, _ := seedOrg(t, d)
	c, e := newClosing(orgA, userA, "2026-10")
	require.NoError(t, repo.Close(context.Background(), c, e))

	_, err := repo.GetActive(context.Background(), orgB, "2026-10")
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	events, err := repo.Events(context.Background(), orgB, "2026-10")
	require.NoError(t, err)
	assert.Empty(t, events)
}

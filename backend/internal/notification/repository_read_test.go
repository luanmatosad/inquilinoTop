package notification_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/internal/notification"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepository_GetByID_PendenteSemEnvio(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	owner := newNotifOwner(t, d, "read@test.com")
	id := newPendingNotif(t, repo, owner, "dest@test.com", nil)

	n, err := repo.GetByID(context.Background(), id, owner)
	require.NoError(t, err)
	assert.Equal(t, string(notification.StatusPending), n.Status)
	assert.Nil(t, n.SentAt)
	assert.Nil(t, n.ScheduledAt)
}

func TestRepository_GetByID_OutroOwnerNaoVe(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	owner := newNotifOwner(t, d, "owner@test.com")
	outro := newNotifOwner(t, d, "outro@test.com")
	id := newPendingNotif(t, repo, owner, "dest@test.com", nil)

	_, err := repo.GetByID(context.Background(), id, outro)
	assert.Error(t, err)
}

func TestRepository_ListByOwner_PendentesSemEnvio(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	owner := newNotifOwner(t, d, "list@test.com")
	id := newPendingNotif(t, repo, owner, "dest@test.com", nil)

	list, err := repo.ListByOwner(context.Background(), owner, string(notification.StatusPending))
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, id, list[0].ID)
	assert.Nil(t, list[0].SentAt)
}

func TestRepository_ListByOwner_EnviadasTemSentAt(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	owner := newNotifOwner(t, d, "sent@test.com")
	id := newPendingNotif(t, repo, owner, "dest@test.com", nil)
	_, err := repo.ReserveAndSend(context.Background(), id, func(notification.Notification) error { return nil })
	require.NoError(t, err)

	list, err := repo.ListByOwner(context.Background(), owner, string(notification.StatusSent))
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.NotNil(t, list[0].SentAt)
}

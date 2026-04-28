package identity_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/internal/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepository_NotificationPreferences(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, err := repo.CreateUser(context.Background(), "notif_prefs@example.com", "hash")
	require.NoError(t, err)

	// Sem preferências inicialmente
	p, err := repo.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Nil(t, p)

	// Upsert cria preferências
	p, err = repo.UpsertNotificationPreferences(context.Background(), user.ID, identity.UpsertNotificationPreferencesInput{
		NotifyPaymentOverdue:     true,
		NotifyLeaseExpiring:      false,
		NotifyLeaseExpiringDays:  15,
		NotifyNewMessage:         true,
		NotifyMaintenanceRequest: false,
		NotifyPaymentReceived:    true,
	})
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, user.ID, p.UserID)
	assert.True(t, p.NotifyPaymentOverdue)
	assert.False(t, p.NotifyLeaseExpiring)
	assert.Equal(t, 15, p.NotifyLeaseExpiringDays)

	// Get retorna o que foi salvo
	p2, err := repo.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	require.NotNil(t, p2)
	assert.Equal(t, 15, p2.NotifyLeaseExpiringDays)

	// Upsert atualiza existente
	p3, err := repo.UpsertNotificationPreferences(context.Background(), user.ID, identity.UpsertNotificationPreferencesInput{
		NotifyPaymentOverdue:     false,
		NotifyLeaseExpiring:      true,
		NotifyLeaseExpiringDays:  30,
		NotifyNewMessage:         false,
		NotifyMaintenanceRequest: true,
		NotifyPaymentReceived:    false,
	})
	require.NoError(t, err)
	assert.False(t, p3.NotifyPaymentOverdue)
	assert.True(t, p3.NotifyLeaseExpiring)
	assert.Equal(t, 30, p3.NotifyLeaseExpiringDays)
}

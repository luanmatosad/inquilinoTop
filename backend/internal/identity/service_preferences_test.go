package identity_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestService_NotificationPreferences(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)

	svc := identity.NewService(repo, jwtSvc)

	user, err := repo.CreateUser(context.Background(), "svc_notif@example.com", "hash")
	require.NoError(t, err)

	// Get when not exists returns nil
	p, err := svc.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Nil(t, p)

	// Update creates and returns preferences
	p2, err := svc.UpdateNotificationPreferences(context.Background(), user.ID, identity.UpsertNotificationPreferencesInput{
		NotifyPaymentOverdue:    true,
		NotifyLeaseExpiring:     true,
		NotifyLeaseExpiringDays: 30,
	})
	require.NoError(t, err)
	require.NotNil(t, p2)
	assert.Equal(t, user.ID, p2.UserID)
	assert.Equal(t, 30, p2.NotifyLeaseExpiringDays)

	// Get now returns the preferences
	p3, err := svc.GetNotificationPreferences(context.Background(), user.ID)
	require.NoError(t, err)
	require.NotNil(t, p3)
	assert.True(t, p3.NotifyPaymentOverdue)
}

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

func TestService_Profile(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)

	svc := identity.NewService(repo, jwtSvc)

	user, err := repo.CreateUser(context.Background(), "svc_profile@example.com", "hash")
	require.NoError(t, err)

	// GetProfile (empty)
	p, err := svc.GetProfile(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Nil(t, p)

	// UpdateProfile
	name := "Svc Name"
	p2, err := svc.UpdateProfile(context.Background(), user.ID, identity.UpsertProfileInput{
		FullName: &name,
	})
	require.NoError(t, err)
	assert.NotNil(t, p2)
	assert.Equal(t, name, *p2.FullName)
}

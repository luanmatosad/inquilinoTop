package identity_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/internal/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepository_Profile(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, err := repo.CreateUser(context.Background(), "profile@example.com", "hash")
	require.NoError(t, err)

	// No profile initially
	p, err := repo.GetProfile(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Nil(t, p)

	// Upsert profile
	name := "Admin Name"
	doc := "12345678901"
	pt := "PF"
	
	p, err = repo.UpsertProfile(context.Background(), user.ID, identity.UpsertProfileInput{
		FullName:   &name,
		Document:   &doc,
		PersonType: &pt,
	})
	require.NoError(t, err)
	assert.NotNil(t, p)
	assert.Equal(t, name, *p.FullName)
	assert.Equal(t, doc, *p.Document)
	assert.Equal(t, pt, *p.PersonType)

	// Get profile
	p2, err := repo.GetProfile(context.Background(), user.ID)
	require.NoError(t, err)
	assert.NotNil(t, p2)
	assert.Equal(t, name, *p2.FullName)

	// Update existing profile
	newName := "Admin Name Updated"
	p3, err := repo.UpsertProfile(context.Background(), user.ID, identity.UpsertProfileInput{
		FullName:   &newName,
		Document:   &doc,
		PersonType: &pt,
	})
	require.NoError(t, err)
	assert.Equal(t, newName, *p3.FullName)
}

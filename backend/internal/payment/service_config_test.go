package payment_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/internal/payment"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestService_FinancialConfig(t *testing.T) {
	database := testDB(t)
	repo := payment.NewRepository(database)
	
	// Create user via sql
	ownerID := createTestUser(t, database)
	
	svc := payment.NewService(repo, nil, nil, nil, "")

	// GET empty
	cfg, err := svc.GetFinancialConfig(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Nil(t, cfg)

	// Upsert initial
	provider := "MOCK"
	pixKey := "test@pix.com"
	in := payment.UpsertFinancialConfigInput{
		Provider: provider,
		Config:   map[string]any{"default_late_fee": "2"},
		PixKey:   &pixKey,
	}

	cfg, err = svc.UpdateFinancialConfig(context.Background(), ownerID, in)
	require.NoError(t, err)
	assert.NotNil(t, cfg)
	assert.Equal(t, provider, cfg.Provider)
	assert.Equal(t, pixKey, *cfg.PixKey)

	// Upsert update
	newPix := "new@pix.com"
	in.PixKey = &newPix
	cfg, err = svc.UpdateFinancialConfig(context.Background(), ownerID, in)
	require.NoError(t, err)
	assert.Equal(t, newPix, *cfg.PixKey)

	// Get config
	cfg2, err := svc.GetFinancialConfig(context.Background(), ownerID)
	require.NoError(t, err)
	assert.Equal(t, newPix, *cfg2.PixKey)
}

package db_test

import (
	"context"
	"testing"

	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew_InvalidURL(t *testing.T) {
	_, err := db.New(context.Background(), "invalid://url")
	assert.Error(t, err)
}

func TestNew_ValidConnection(t *testing.T) {
	url := "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	defer d.Close()
	assert.NotNil(t, d.Pool)
}

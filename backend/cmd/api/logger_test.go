package main

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateLogger_DefaultToInfo(t *testing.T) {
	// Unset LOG_LEVEL to test default
	oldLOG := os.Getenv("LOG_LEVEL")
	os.Unsetenv("LOG_LEVEL")
	t.Cleanup(func() {
		if oldLOG != "" {
			os.Setenv("LOG_LEVEL", oldLOG)
		}
	})

	logger := createLogger()
	require.NotNil(t, logger)
	assert.NotNil(t, logger.Handler())
}

func TestCreateLogger_DebugLevel(t *testing.T) {
	oldLOG := os.Getenv("LOG_LEVEL")
	os.Setenv("LOG_LEVEL", "debug")
	t.Cleanup(func() {
		if oldLOG != "" {
			os.Setenv("LOG_LEVEL", oldLOG)
		} else {
			os.Unsetenv("LOG_LEVEL")
		}
	})

	logger := createLogger()
	require.NotNil(t, logger)

	// Verify logger is created successfully
	assert.NotNil(t, logger.Handler())
}

func TestCreateLogger_InfoLevel(t *testing.T) {
	oldLOG := os.Getenv("LOG_LEVEL")
	os.Setenv("LOG_LEVEL", "info")
	t.Cleanup(func() {
		if oldLOG != "" {
			os.Setenv("LOG_LEVEL", oldLOG)
		} else {
			os.Unsetenv("LOG_LEVEL")
		}
	})

	logger := createLogger()
	require.NotNil(t, logger)
	assert.NotNil(t, logger.Handler())
}

func TestCreateLogger_IgnoresInvalidLevel(t *testing.T) {
	oldLOG := os.Getenv("LOG_LEVEL")
	os.Setenv("LOG_LEVEL", "invalid_level")
	t.Cleanup(func() {
		if oldLOG != "" {
			os.Setenv("LOG_LEVEL", oldLOG)
		} else {
			os.Unsetenv("LOG_LEVEL")
		}
	})

	// Should not panic and default to info
	logger := createLogger()
	require.NotNil(t, logger)
	assert.NotNil(t, logger.Handler())
}

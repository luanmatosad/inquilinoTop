package provider

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewAsaasProvider_ProductionURLHasScheme(t *testing.T) {
	p, err := NewAsaasProvider(map[string]string{
		"api_key":     "key123",
		"environment": "production",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(p.baseURL, "https://"),
		"production baseURL deve começar com https://, got: %s", p.baseURL)
}

func TestNewAsaasProvider_SandboxURLHasScheme(t *testing.T) {
	p, err := NewAsaasProvider(map[string]string{
		"api_key":     "key123",
		"environment": "sandbox",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(p.baseURL, "https://"),
		"sandbox baseURL deve começar com https://, got: %s", p.baseURL)
}

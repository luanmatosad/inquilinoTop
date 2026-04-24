package provider

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewProvider_AcceptsUppercaseProviderTypes(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		config   map[string]string
	}{
		{"ASAAS uppercase", "ASAAS", map[string]string{"api_key": "test_key"}},
		{"BRADESCO uppercase", "BRADESCO", map[string]string{"client_id": "test", "client_secret": "test"}},
		{"ITAU uppercase", "ITAU", map[string]string{"client_id": "test", "client_secret": "test"}},
		{"SICOOB uppercase", "SICOOB", map[string]string{"client_id": "test", "client_secret": "test"}},
		{"MOCK uppercase", "MOCK", map[string]string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewProvider(tt.provider, tt.config)
			require.NoError(t, err)
			assert.NotNil(t, p)
		})
	}
}

func TestNewProvider_AcceptsLowercaseProviderTypes(t *testing.T) {
	tests := []struct {
		name     string
		provider string
		config   map[string]string
	}{
		{"asaas lowercase", "asaas", map[string]string{"api_key": "test_key"}},
		{"mock lowercase", "mock", map[string]string{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := NewProvider(tt.provider, tt.config)
			require.NoError(t, err)
			assert.NotNil(t, p)
		})
	}
}

func TestNewProvider_UnknownProviderReturnsError(t *testing.T) {
	_, err := NewProvider("UNKNOWN_BANK", map[string]string{})
	assert.ErrorIs(t, err, ErrUnknownProvider)
}

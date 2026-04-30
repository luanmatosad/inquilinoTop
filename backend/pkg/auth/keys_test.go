package auth_test

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"path/filepath"
	"testing"

	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateTestPEM(t *testing.T) []byte {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	keyBytes := x509.MarshalPKCS1PrivateKey(privKey)
	return pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: keyBytes})
}

func TestLoadPrivateKeyFromEnvOrFile_FromEnv(t *testing.T) {
	pemData := generateTestPEM(t)
	t.Setenv("JWT_PRIVATE_KEY", string(pemData))
	t.Setenv("JWT_PRIVATE_KEY_PATH", "")

	key, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	require.NoError(t, err)
	assert.NotNil(t, key)
}

func TestLoadPrivateKeyFromEnvOrFile_FromFile(t *testing.T) {
	pemData := generateTestPEM(t)
	dir := t.TempDir()
	keyPath := filepath.Join(dir, "private.pem")
	require.NoError(t, os.WriteFile(keyPath, pemData, 0600))
	t.Setenv("JWT_PRIVATE_KEY", "")
	t.Setenv("JWT_PRIVATE_KEY_PATH", keyPath)

	key, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	require.NoError(t, err)
	assert.NotNil(t, key)
}

func TestLoadPrivateKeyFromEnvOrFile_EnvTakesPrecedence(t *testing.T) {
	pemData := generateTestPEM(t)
	t.Setenv("JWT_PRIVATE_KEY", string(pemData))
	t.Setenv("JWT_PRIVATE_KEY_PATH", "/nonexistent/should/be/ignored.pem")

	key, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	require.NoError(t, err)
	assert.NotNil(t, key)
}

func TestLoadPrivateKeyFromEnvOrFile_NeitherSet(t *testing.T) {
	t.Setenv("JWT_PRIVATE_KEY", "")
	t.Setenv("JWT_PRIVATE_KEY_PATH", "")

	_, err := auth.LoadPrivateKeyFromEnvOrFile("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH")
	assert.Error(t, err)
}

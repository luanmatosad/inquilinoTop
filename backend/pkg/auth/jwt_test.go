package auth_test

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func loadKeys(t *testing.T) (*rsa.PrivateKey, *rsa.PublicKey) {
	t.Helper()
	privBytes, err := os.ReadFile("../../keys/private.pem")
	require.NoError(t, err)
	block, _ := pem.Decode(privBytes)
	privKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	require.NoError(t, err)
	return privKey, &privKey.PublicKey
}

func TestSignAndVerify(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	svc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, err := svc.Sign(ownerID)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	claims, err := svc.Verify(token)
	require.NoError(t, err)
	assert.Equal(t, ownerID, claims.OwnerID)
}

func TestVerify_ExpiredToken(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	svc := auth.NewJWTService(privKey, pubKey, -1*time.Second)

	token, _ := svc.Sign(uuid.New())
	_, err := svc.Verify(token)
	assert.Error(t, err)
}

func TestMiddleware_ValidToken(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	jwtSvc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	ownerID := uuid.New()
	token, _ := jwtSvc.Sign(ownerID)

	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		got := auth.OwnerIDFromCtx(r.Context())
		assert.Equal(t, ownerID, got)
		w.WriteHeader(http.StatusOK)
	})

	mw := auth.Middleware(jwtSvc)
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	mw(next).ServeHTTP(w, req)

	assert.True(t, called)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddleware_NoToken(t *testing.T) {
	privKey, pubKey := loadKeys(t)
	jwtSvc := auth.NewJWTService(privKey, pubKey, 15*time.Minute)

	mw := auth.Middleware(jwtSvc)
	req := httptest.NewRequest("GET", "/", nil)
	w := httptest.NewRecorder()
	mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})).ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

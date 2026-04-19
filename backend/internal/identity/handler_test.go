package identity_test

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestHandler(t *testing.T) (http.Handler, *identity.Service) {
	t.Helper()
	privKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	svc := identity.NewService(newMockRepo(), jwtSvc)
	h := identity.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r)
	return r, svc
}

func TestHandler_Register(t *testing.T) {
	router, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"email": "h@test.com", "password": "senha123"})
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	assert.NotEmpty(t, data["access_token"])
	assert.NotEmpty(t, data["refresh_token"])
}

func TestHandler_Login(t *testing.T) {
	router, svc := newTestHandler(t)
	svc.Register("login@test.com", "senha")

	body, _ := json.Marshal(map[string]string{"email": "login@test.com", "password": "senha"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandler_Login_InvalidCredentials(t *testing.T) {
	router, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"email": "none@test.com", "password": "wrong"})
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

var _ = require.NoError // avoid unused import

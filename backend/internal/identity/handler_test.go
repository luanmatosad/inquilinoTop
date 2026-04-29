package identity_test

import (
	"bytes"
	"context"
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
	h.RegisterProtected(r, auth.Middleware(jwtSvc))
	return r, svc
}

func TestHandler_Register(t *testing.T) {
	router, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"email": "h@test.com", "password": "senha123"})
	req := httptest.NewRequest("POST", "/auth/register", bytes.NewReader(body))
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
	svc.Register(context.Background(), "login@test.com", "senha1234")

	body, _ := json.Marshal(map[string]string{"email": "login@test.com", "password": "senha1234"})
	req := httptest.NewRequest("POST", "/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandler_Login_InvalidCredentials(t *testing.T) {
	router, _ := newTestHandler(t)

	body, _ := json.Marshal(map[string]string{"email": "none@test.com", "password": "wrong"})
	req := httptest.NewRequest("POST", "/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandler_Setup2FA_DoesNotExposeUserExistence(t *testing.T) {
	router, svc := newTestHandler(t)
	user, _ := svc.Register(context.Background(), "exists@test.com", "senha123")

	body, _ := json.Marshal(map[string]string{"email": "naoexiste@test.com"})
	req := httptest.NewRequest(http.MethodPost, "/auth/2fa/setup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+user.AccessToken)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.NotEqual(t, http.StatusNotFound, w.Code, "não deve revelar que usuário não existe")
}

func TestHandler_Setup2FA_EmailVálido(t *testing.T) {
	router, svc := newTestHandler(t)
	user, _ := svc.Register(context.Background(), "setup2fa@test.com", "senha123")

	body, _ := json.Marshal(map[string]string{"email": "setup2fa@test.com"})
	req := httptest.NewRequest(http.MethodPost, "/auth/2fa/setup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+user.AccessToken)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHandler_Verify2FA_RequiresAuth(t *testing.T) {
	repo := newMockRepo()
	privKey, _ := rsa.GenerateKey(rand.Reader, 2048)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	svc := identity.NewService(repo, jwtSvc)
	h := identity.NewHandler(svc)

	body, _ := json.Marshal(map[string]string{"code": "123456"})
	req := httptest.NewRequest(http.MethodPost, "/auth/2fa/verify", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := chi.NewRouter()
	blockingAuth := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
		})
	}
	h.RegisterProtected(r, blockingAuth)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

var _ = require.NoError // avoid unused import

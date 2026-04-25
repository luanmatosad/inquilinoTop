package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCORSMiddleware_UnsetEnvRejectsAllOrigins(t *testing.T) {
	os.Unsetenv("CORS_ALLOWED_ORIGINS")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := corsMiddleware(next)

	req := httptest.NewRequest(http.MethodOptions, "/", nil)
	req.Header.Set("Origin", "https://evil.com")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code, "env não setada deve rejeitar OPTIONS de origem desconhecida")
	assert.Empty(t, rr.Header().Get("Access-Control-Allow-Origin"), "env não setada não deve emitir header CORS")
}

func TestCORSMiddleware_AllowsConfiguredOrigin(t *testing.T) {
	os.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")
	defer os.Unsetenv("CORS_ALLOWED_ORIGINS")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := corsMiddleware(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://app.example.com")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, "https://app.example.com", rr.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSMiddleware_RejectsUnconfiguredOrigin(t *testing.T) {
	os.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")
	defer os.Unsetenv("CORS_ALLOWED_ORIGINS")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := corsMiddleware(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://evil.com")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Empty(t, rr.Header().Get("Access-Control-Allow-Origin"), "origem não configurada não deve receber header CORS")
}

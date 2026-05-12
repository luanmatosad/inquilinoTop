package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
)

// TestRouting_HandlerPathsAccessible verifica que o middleware de rewrite
// de /api/v1/* → /* permite que handlers registrados sem prefixo sejam
// acessados via /api/v1/<rota>.
func TestRouting_HandlerPathsAccessible(t *testing.T) {
	called := false
	h := func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}

	r := chi.NewRouter()
	// Middleware de rewrite — igual ao main.go
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/api/v1") {
				req.URL.Path = strings.Replace(req.URL.Path, "/api/v1", "", 1)
			}
			next.ServeHTTP(w, req)
		})
	})
	r.Get("/properties", h) // handler registrado SEM prefixo

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code,
		"rewrite middleware deve fazer /api/v1/properties chegar em /properties")
	assert.True(t, called, "handler deve ter sido chamado")
}

// TestRouting_DeprecationHeaderApplied verifica que o middleware de deprecação
// aplica o header Deprecation em rotas /api/v1/.
func TestRouting_DeprecationHeaderApplied(t *testing.T) {
	h := func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/api/v1/") {
				w.Header().Set("Deprecation", "true")
			}
			next.ServeHTTP(w, req)
		})
	})
	r.Get("/api/v1/properties", h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "true", rr.Header().Get("Deprecation"),
		"header Deprecation deve estar presente em rotas /api/v1/")
}

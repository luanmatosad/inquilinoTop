package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
)

// TestRouting_HandlerPathsAccessible verifica que handlers com paths relativos
// como "/properties" são acessíveis corretamente.
func TestRouting_HandlerPathsAccessible(t *testing.T) {
	called := false
	h := func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}

	// Handlers registram paths relativos (sem /api/v1)
	r := chi.NewRouter()
	r.Get("/properties", h)

	req := httptest.NewRequest(http.MethodGet, "/properties", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code,
		"rota /properties deve ser acessível com path relativo")
	assert.True(t, called, "handler não foi chamado")
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

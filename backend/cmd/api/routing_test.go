package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
)

// TestRouting_HandlerPathsAccessible verifica que handlers com paths absolutos
// como "/api/v1/properties" são acessíveis nesses paths quando registrados no router.
// Bug: ao usar r.Route("/api/v1", fn) + fn registra "/api/v1/properties",
// a rota efetiva vira "/api/v1/api/v1/properties" — inacessível no path documentado.
func TestRouting_HandlerPathsAccessible(t *testing.T) {
	called := false
	h := func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}

	// Simula o padrão atual de main.go: handler registra path absoluto dentro de subrouter
	r := chi.NewRouter()
	r.Route("/api/v1", func(r1 chi.Router) {
		r1.Get("/api/v1/properties", h) // path absoluto dentro de subrouter com prefixo
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code,
		"rota /api/v1/properties deve ser acessível — com r.Route a rota fica em /api/v1/api/v1/properties (bug)")
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

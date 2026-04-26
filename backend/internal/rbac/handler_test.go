package rbac_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func newRBACRouter() chi.Router {
	svc := rbac.NewService(newMockRoleRepo())
	h := rbac.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	return r
}

func TestHandler_GetMyRoles_Vazio(t *testing.T) {
	r := newRBACRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v2/me/roles", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	assert.NotNil(t, body["data"])
}

func TestHandler_AssignRole_BodyInválido(t *testing.T) {
	r := newRBACRouter()
	req := httptest.NewRequest(http.MethodPost, "/api/v2/roles", bytes.NewBufferString("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_AssignRole_RoleInválida(t *testing.T) {
	r := newRBACRouter()
	body, _ := json.Marshal(map[string]interface{}{
		"user_id": uuid.New().String(),
		"role":    "superadmin",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v2/roles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_AssignRole_Válido(t *testing.T) {
	r := newRBACRouter()
	propID := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"user_id":     uuid.New().String(),
		"role":        "viewer",
		"property_id": propID.String(),
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v2/roles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_AssignRole_Duplicado(t *testing.T) {
	mock := newMockRoleRepo()
	svc := rbac.NewService(mock)
	h := rbac.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	userID := uuid.New()
	propID := uuid.New()
	svc.AssignRole(context.Background(), userID, rbac.RoleAdmin, &propID)

	body, _ := json.Marshal(map[string]interface{}{
		"user_id":     userID.String(),
		"role":        "admin",
		"property_id": propID.String(),
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v2/roles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusConflict, rr.Code)
}

func TestHandler_RemoveRole_BodyInválido(t *testing.T) {
	r := newRBACRouter()
	req := httptest.NewRequest(http.MethodDelete, "/api/v2/roles", bytes.NewBufferString("bad"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_RemoveRole_NãoEncontrado(t *testing.T) {
	r := newRBACRouter()
	body, _ := json.Marshal(map[string]interface{}{
		"user_id": uuid.New().String(),
		"role":    "owner",
	})
	req := httptest.NewRequest(http.MethodDelete, "/api/v2/roles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestHandler_RemoveRole_Válido(t *testing.T) {
	mock := newMockRoleRepo()
	svc := rbac.NewService(mock)
	h := rbac.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	userID := uuid.New()
	svc.AssignRole(context.Background(), userID, rbac.RoleOwner, nil)

	body, _ := json.Marshal(map[string]interface{}{
		"user_id": userID.String(),
		"role":    "owner",
	})
	req := httptest.NewRequest(http.MethodDelete, "/api/v2/roles", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusOK, rr.Code)
}

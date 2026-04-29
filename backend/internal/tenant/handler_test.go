package tenant_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func authMWWithOwnerID(ownerID uuid.UUID) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := auth.WithOwnerID(r.Context(), ownerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/tenants", bytes.NewReader([]byte("invalid")))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	pf := "PF"
	body, _ := json.Marshal(tenant.CreateTenantInput{
		Name:       "Foo",
		PersonType: &pf,
	})
	req := httptest.NewRequest(http.MethodPost, "/tenants", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Create_SemName(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	pf := "PF"
	body, _ := json.Marshal(tenant.CreateTenantInput{
		PersonType: &pf,
	})
	req := httptest.NewRequest(http.MethodPost, "/tenants", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/tenants/not-a-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Get_Válido(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	h := tenant.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	pf := "PF"
	t1, _ := svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name: "Foo", PersonType: &pf,
	})

	req := httptest.NewRequest(http.MethodGet, "/tenants/"+t1.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/tenants/not-a-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_Válido(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	h := tenant.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	pf := "PF"
	t1, _ := svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name: "Foo", PersonType: &pf,
	})

	body, _ := json.Marshal(tenant.CreateTenantInput{
		Name:       "Bar",
		PersonType: &pf,
	})
	req := httptest.NewRequest(http.MethodPut, "/tenants/"+t1.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/tenants/not-a-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_Válido(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	h := tenant.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	pf := "PF"
	t1, _ := svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{
		Name: "Foo", PersonType: &pf,
	})

	req := httptest.NewRequest(http.MethodDelete, "/tenants/"+t1.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_List_Válido(t *testing.T) {
	mock := newMockTenantRepo()
	svc := tenant.NewService(mock)
	h := tenant.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	pf := "PF"
	svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "A", PersonType: &pf})
	svc.Create(context.Background(), ownerID, tenant.CreateTenantInput{Name: "B", PersonType: &pf})

	req := httptest.NewRequest(http.MethodGet, "/tenants", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}
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

func noopWriteMw(next http.Handler) http.Handler {
	return next
}

func authMWWithOwnerID(ownerID uuid.UUID) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			orgID := ownerID // Use same ID for consistency
			ctx := auth.WithOwnerIDOrgIDRole(r.Context(), ownerID, orgID, "admin")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	req := httptest.NewRequest(http.MethodPost, "/tenants", bytes.NewReader([]byte("invalid")))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	h := tenant.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

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
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

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
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

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
	h.Register(r, authMWWithOwnerID(ownerID), noopWriteMw, noopWriteMw)

	pf := "PF"
	t1, _ := svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{
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
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

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
	h.Register(r, authMWWithOwnerID(ownerID), noopWriteMw, noopWriteMw)

	pf := "PF"
	t1, _ := svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{
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
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

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
	h.Register(r, authMWWithOwnerID(ownerID), noopWriteMw, noopWriteMw)

	pf := "PF"
	t1, _ := svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{
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
	h.Register(r, authMWWithOwnerID(ownerID), noopWriteMw, noopWriteMw)

	pf := "PF"
	svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{Name: "A", PersonType: &pf})
	svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{Name: "B", PersonType: &pf})

	req := httptest.NewRequest(http.MethodGet, "/tenants", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func postTenant(t *testing.T, r http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/tenants", bytes.NewReader([]byte(body)))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func newTenantRouter(svc *tenant.Service, ownerID uuid.UUID) http.Handler {
	r := chi.NewRouter()
	tenant.NewHandler(svc).Register(r, authMWWithOwnerID(ownerID), noopWriteMw, noopWriteMw)
	return r
}

func TestHandler_Create_DocumentoInválido_400(t *testing.T) {
	r := newTenantRouter(tenant.NewService(newMockTenantRepo()), uuid.New())
	rr := postTenant(t, r, `{"name":"Ana","person_type":"PF","document":"52998224726"}`)
	require.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Contains(t, rr.Body.String(), "INVALID_DOCUMENT")
}

func TestHandler_Create_DocumentoDuplicado_409(t *testing.T) {
	r := newTenantRouter(tenant.NewService(newMockTenantRepo()), uuid.New())
	first := postTenant(t, r, `{"name":"Ana","person_type":"PF","document":"529.982.247-25"}`)
	require.Equal(t, http.StatusCreated, first.Code)
	assert.Contains(t, first.Body.String(), `"52998224725"`)

	rr := postTenant(t, r, `{"name":"Outra","person_type":"PF","document":"52998224725"}`)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "DUPLICATE_DOCUMENT")
}

func TestHandler_Create_CEPInválido_400(t *testing.T) {
	r := newTenantRouter(tenant.NewService(newMockTenantRepo()), uuid.New())
	rr := postTenant(t, r, `{"name":"Ana","person_type":"PF","postal_code":"123"}`)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_DocumentoDuplicado_409(t *testing.T) {
	ownerID := uuid.New()
	svc := tenant.NewService(newMockTenantRepo())
	r := newTenantRouter(svc, ownerID)
	pf := "PF"
	a, err := svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{Name: "Ana", PersonType: &pf, Document: sp(cpfA)})
	require.NoError(t, err)
	b, err := svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{Name: "Bia", PersonType: &pf, Document: sp(cpfB)})
	require.NoError(t, err)
	_ = a

	req := httptest.NewRequest(http.MethodPut, "/tenants/"+b.ID.String(), bytes.NewReader([]byte(`{"name":"Bia","person_type":"PF","document":"`+cpfA+`"}`)))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "DUPLICATE_DOCUMENT")
}

func TestHandler_Delete_ContratoAtivo_409(t *testing.T) {
	ownerID := uuid.New()
	checker := &fakeLeaseChecker{active: map[uuid.UUID]bool{}}
	svc := tenant.NewService(newMockTenantRepo()).WithLeaseChecker(checker)
	r := newTenantRouter(svc, ownerID)
	pf := "PF"
	a, err := svc.Create(context.Background(), ownerID, ownerID, tenant.CreateTenantInput{Name: "Ana", PersonType: &pf})
	require.NoError(t, err)
	checker.active[a.ID] = true

	req := httptest.NewRequest(http.MethodDelete, "/tenants/"+a.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "TENANT_HAS_ACTIVE_LEASE")
}

func TestHandler_List_Vazia(t *testing.T) {
	r := newTenantRouter(tenant.NewService(newMockTenantRepo()), uuid.New())
	req := httptest.NewRequest(http.MethodGet, "/tenants", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"data":[]`)
}

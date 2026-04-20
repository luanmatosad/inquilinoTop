package property_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	body, _ := json.Marshal(property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/properties/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_CreateUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties/nao-e-uuid/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_CreateUnit_BodyInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	propertyID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties/"+propertyID.String()+"/units", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_GetUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_UpdateUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_DeleteUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListUnits_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties/nao-e-uuid/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListUnits_RouteExists(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	propertyID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/properties/"+propertyID.String()+"/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.NotEqual(t, http.StatusMethodNotAllowed, rr.Code, "GET /properties/{id}/units route should exist")
	require.NotEqual(t, http.StatusNotFound, rr.Code, "GET /properties/{id}/units route should be registered")

	var body map[string]interface{}
	err := json.NewDecoder(rr.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rr.Code)
}

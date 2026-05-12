package property_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
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
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/properties", strings.NewReader("not-json"))
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
	req := httptest.NewRequest(http.MethodPost, "/properties", bytes.NewReader(body))
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

	req := httptest.NewRequest(http.MethodGet, "/properties/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/properties/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_CreateUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/properties/nao-e-uuid/units", nil)
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
	req := httptest.NewRequest(http.MethodPost, "/properties/"+propertyID.String()+"/units", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_GetUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_UpdateUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_DeleteUnit_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/units/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListUnits_IDInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/properties/nao-e-uuid/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListUnits_RouteExists(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa"})
	req := httptest.NewRequest(http.MethodGet, "/properties/"+p.ID.String()+"/units", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.NotEqual(t, http.StatusMethodNotAllowed, rr.Code, "GET /properties/{id}/units route should exist")
	require.NotEqual(t, http.StatusNotFound, rr.Code, "GET /properties/{id}/units route should be registered")

	var body map[string]interface{}
	err := json.NewDecoder(rr.Body).Decode(&body)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Get_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa"})

	req := httptest.NewRequest(http.MethodGet, "/properties/"+p.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Update_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa"})

	body, _ := json.Marshal(property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa Atualizada"})
	req := httptest.NewRequest(http.MethodPut, "/properties/"+p.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	svc := property.NewService(newMockRepo())
	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	propertyID := uuid.New()
	req := httptest.NewRequest(http.MethodPut, "/properties/"+propertyID.String(), strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Casa"})

	req := httptest.NewRequest(http.MethodDelete, "/properties/"+p.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_CreateUnit_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})

	body, _ := json.Marshal(property.CreateUnitInput{Label: "Apto 101"})
	req := httptest.NewRequest(http.MethodPost, "/properties/"+p.ID.String()+"/units", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_UpdateUnit_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 101"})

	body, _ := json.Marshal(property.CreateUnitInput{Label: "Apto 102"})
	req := httptest.NewRequest(http.MethodPut, "/units/"+u.ID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_GetUnit_RequiresOwnerMatch(t *testing.T) {
	ownerA := uuid.New()
	ownerB := uuid.New()
	unitID := uuid.New()

	mock := newMockRepo()
	mock.units[unitID] = &property.Unit{ID: unitID, PropertyID: uuid.New(), Label: "A101", IsActive: true}
	mock.unitOwners[unitID] = ownerA

	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/units/"+unitID.String(), nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), ownerB))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code, "ownerB não deve acessar unit de ownerA")
}

func TestHandler_GetUnit_AllowsCorrectOwner(t *testing.T) {
	ownerA := uuid.New()
	unitID := uuid.New()
	propID := uuid.New()

	mock := newMockRepo()
	mock.units[unitID] = &property.Unit{ID: unitID, PropertyID: propID, Label: "A101", IsActive: true}
	mock.unitOwners[unitID] = ownerA

	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	req := httptest.NewRequest(http.MethodGet, "/units/"+unitID.String(), nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), ownerA))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code, "ownerA deve acessar sua própria unit")
}

func TestHandler_DeleteUnit_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)
	h := property.NewHandler(svc)

	ownerID := uuid.New()
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(ownerID))

	p, _ := svc.CreateProperty(context.Background(), ownerID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	u, _ := svc.CreateUnit(context.Background(), p.ID, ownerID, property.CreateUnitInput{Label: "Apto 101"})

	req := httptest.NewRequest(http.MethodDelete, "/units/"+u.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
}

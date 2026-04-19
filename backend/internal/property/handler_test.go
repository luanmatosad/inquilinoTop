package property_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

package property_test

import (
	"context"
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

func TestHandler_UpdateProperty_InvalidBody(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)

	p, err := svc.CreateProperty(context.Background(), uuid.Nil, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Test"})
	require.NoError(t, err)

	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest("PUT", "/api/v1/properties/"+p.ID.String(), strings.NewReader("{bad json"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_CreateUnit_InvalidBody(t *testing.T) {
	mock := newMockRepo()
	svc := property.NewService(mock)

	p, err := svc.CreateProperty(context.Background(), uuid.Nil, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Test"})
	require.NoError(t, err)

	h := property.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest("POST", "/api/v1/properties/"+p.ID.String()+"/units", strings.NewReader("{bad"))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

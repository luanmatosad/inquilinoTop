package rbac_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMiddleware_ReturnsJSONEnvelope_WhenUnauthorized(t *testing.T) {
	repo := newMockRoleRepo()
	svc := rbac.NewService(repo)
	mw := rbac.Middleware(svc)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// No owner_id in context → must return 401 with JSON envelope
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	var body map[string]interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &body)
	require.NoError(t, err, "resposta deve ser JSON")
	assert.NotNil(t, body["error"], "resposta deve ter campo 'error'")
}

func TestMiddleware_AllowsRequestWithOwnerID_WhenNoRoleParam(t *testing.T) {
	repo := newMockRoleRepo()
	svc := rbac.NewService(repo)
	mw := rbac.Middleware(svc)

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	ownerID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(auth.WithOwnerID(context.Background(), ownerID))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.True(t, nextCalled, "com ownerID e sem role param, deve chamar next")
}

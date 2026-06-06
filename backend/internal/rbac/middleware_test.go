package rbac_test

import (
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

func TestPermissionMiddleware_Returns401_WhenNoOwnerID(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPropertyWrite)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	var body map[string]interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.NotNil(t, body["error"])
}

func TestPermissionMiddleware_Returns403_WhenNoOrgID(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPropertyWrite)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(auth.WithOwnerID(req.Context(), uuid.New()))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestPermissionMiddleware_Returns403_WhenNoRole(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPropertyWrite)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(auth.WithOwnerIDOrgID(req.Context(), uuid.New(), uuid.New()))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code)
}

func TestPermissionMiddleware_AllowsViewerToRead(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPropertyRead)

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), uuid.New(), "viewer"))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.True(t, nextCalled)
}

func TestPermissionMiddleware_BlocksViewerFromWrite(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPropertyWrite)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), uuid.New(), "viewer"))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code)
}

func TestPermissionMiddleware_AllowsAdminToWrite(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPropertyWrite)

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), uuid.New(), "admin"))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.True(t, nextCalled)
}

func TestPermissionMiddleware_BlocksEmployeeFromPaymentWrite(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPaymentWrite)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), uuid.New(), "employee"))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code)
}

func TestPermissionMiddleware_AllowsManagerToPaymentWrite(t *testing.T) {
	mw := rbac.PermissionMiddleware(rbac.PermissionPaymentWrite)

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), uuid.New(), "manager"))
	rr := httptest.NewRecorder()
	mw(next).ServeHTTP(rr, req)

	assert.True(t, nextCalled)
}
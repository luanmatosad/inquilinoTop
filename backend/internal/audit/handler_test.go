package audit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/require"
)

type mockAuditRepo struct {
	logs []AuditLog
	err error
}

func (m *mockAuditRepo) Create(ctx context.Context, ownerID uuid.UUID, in CreateInput) (*AuditLog, error) {
	return &AuditLog{ID: uuid.New()}, nil
}

func (m *mockAuditRepo) List(ctx context.Context, ownerID uuid.UUID, from, to *time.Time, eventType *string) ([]AuditLog, error) {
	return m.logs, m.err
}

func TestHandler_List_UsesQueryParams(t *testing.T) {
	repo := &mockAuditRepo{logs: []AuditLog{}}
	svc := NewService(repo)
	h := NewHandler(svc)

	ownerID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs?from=2024-01-01T00:00:00Z&event_type=LOGIN", nil)
	req = req.WithContext(auth.WithOwnerID(context.Background(), ownerID))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, "GET com query params deve funcionar")
}

func TestHandler_List_WithEmptyBody_Works(t *testing.T) {
	repo := &mockAuditRepo{logs: []AuditLog{}}
	svc := NewService(repo)
	h := NewHandler(svc)

	ownerID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/audit-logs", nil)
	req = req.WithContext(auth.WithOwnerID(context.Background(), ownerID))
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code, "GET sem params e sem body deve funcionar")
}
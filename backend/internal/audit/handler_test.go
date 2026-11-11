package audit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/require"
)

type mockAuditRepo struct {
	logs []AuditLog
	err  error
}

func (m *mockAuditRepo) Create(ctx context.Context, organizationID, ownerID uuid.UUID, in CreateInput) (*AuditLog, error) {
	return &AuditLog{ID: uuid.New()}, nil
}

func (m *mockAuditRepo) List(ctx context.Context, organizationID, ownerID uuid.UUID, from, to *time.Time, eventType *string) ([]AuditLog, error) {
	return m.logs, m.err
}

type fakeRoles struct {
	role rbac.RoleType
	err  error
}

func (f fakeRoles) RoleIn(context.Context, uuid.UUID, uuid.UUID) (rbac.RoleType, error) {
	return f.role, f.err
}

func listWith(t *testing.T, roles rbac.MembershipRoles, ctx context.Context, url string) *httptest.ResponseRecorder {
	t.Helper()
	h := NewHandler(NewService(&mockAuditRepo{logs: []AuditLog{}}), roles)
	req := httptest.NewRequest(http.MethodGet, url, nil).WithContext(ctx)
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler { return next })
	r.ServeHTTP(rr, req)
	return rr
}

func contextoDeMembro() context.Context {
	return auth.WithOwnerIDOrgID(context.Background(), uuid.New(), uuid.New())
}

func TestHandler_List_UsesQueryParams(t *testing.T) {
	rr := listWith(t, fakeRoles{role: rbac.RoleOwner}, contextoDeMembro(),
		"/audit-logs?from=2024-01-01T00:00:00Z&event_type=LOGIN")

	require.Equal(t, http.StatusOK, rr.Code, "GET com query params deve funcionar")
}

func TestHandler_List_WithEmptyBody_Works(t *testing.T) {
	rr := listWith(t, fakeRoles{role: rbac.RoleOwner}, contextoDeMembro(), "/audit-logs")

	require.Equal(t, http.StatusOK, rr.Code, "GET sem params e sem body deve funcionar")
}

func TestHandler_List_NaoOwnerRecebe403(t *testing.T) {
	rr := listWith(t, fakeRoles{role: rbac.RoleAdmin}, contextoDeMembro(), "/audit-logs")

	require.Equal(t, http.StatusForbidden, rr.Code)
}

func TestHandler_List_MembroRemovidoRecebe403(t *testing.T) {
	rr := listWith(t, fakeRoles{err: rbac.ErrNotMember}, contextoDeMembro(), "/audit-logs")

	require.Equal(t, http.StatusForbidden, rr.Code)
}

func TestHandler_List_ErroDoBancoRecebe500(t *testing.T) {
	rr := listWith(t, fakeRoles{err: errors.New("db down")}, contextoDeMembro(), "/audit-logs")

	require.Equal(t, http.StatusInternalServerError, rr.Code)
	require.NotContains(t, rr.Body.String(), "db down")
}

func TestHandler_List_SemOrganizacaoRecebe401(t *testing.T) {
	ctx := auth.WithOwnerID(context.Background(), uuid.New())
	rr := listWith(t, fakeRoles{role: rbac.RoleOwner}, ctx, "/audit-logs")

	require.Equal(t, http.StatusUnauthorized, rr.Code)
}

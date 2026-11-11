package organization_test

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
	"github.com/inquilinotop/api/internal/organization"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeRoles devolve o papel fixo do usuário na organização, como o banco faria.
type fakeRoles struct{ role rbac.RoleType }

func (f fakeRoles) RoleIn(_ context.Context, _, _ uuid.UUID) (rbac.RoleType, error) {
	return f.role, nil
}

// newRouteTestServer monta as rotas de organização com RBAC real e papel do usuário fixo.
func newRouteTestServer(role rbac.RoleType) (http.Handler, uuid.UUID) {
	userID := uuid.New()
	repo := newMockRepo()
	orgID := seedOrg(repo, "Administradora X")
	return buildRoutes(repo, role, userID, orgID), userID
}

// buildRoutes monta as rotas com RBAC real, papel fixo do usuário e o repositório dado.
func buildRoutes(repo organization.Repository, role rbac.RoleType, userID, orgID uuid.UUID) http.Handler {
	roles := fakeRoles{role: role}
	authMw := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(setupTestContext(userID, orgID)))
		})
	}
	guards := organization.Guards{
		OrgRead:      rbac.PermissionMiddleware(roles, rbac.PermissionOrgRead),
		OrgUpdate:    rbac.PermissionMiddleware(roles, rbac.PermissionOrgUpdate),
		BranchManage: rbac.PermissionMiddleware(roles, rbac.PermissionBranchManage),
		MemberManage: rbac.PermissionMiddleware(roles, rbac.PermissionMemberManage),
		MemberInvite: rbac.PermissionMiddleware(roles, rbac.PermissionMemberInvite),
	}
	h := organization.NewHandler(newTestService(repo))
	r := chi.NewRouter()
	h.RegisterRoutes(r, authMw, guards)
	return r
}

func postInvite(t *testing.T, srv http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/organizations/me/invites", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)
	return rec
}

func TestHandler_Routes_ViewerNaoConvida(t *testing.T) {
	srv, _ := newRouteTestServer(rbac.RoleViewer)

	rec := postInvite(t, srv, `{"email":"novo@x.com","role":"viewer"}`)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("esperado 403, veio %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "FORBIDDEN") {
		t.Fatalf("código FORBIDDEN ausente: %s", rec.Body.String())
	}
}

func TestHandler_Routes_ViewerNaoRemoveMembro(t *testing.T) {
	srv, _ := newRouteTestServer(rbac.RoleViewer)

	req := httptest.NewRequest(http.MethodDelete, "/organizations/me/members/"+uuid.New().String(), nil)
	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("esperado 403, veio %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_Routes_AdminConvidaViewer(t *testing.T) {
	srv, _ := newRouteTestServer(rbac.RoleAdmin)

	rec := postInvite(t, srv, `{"email":"novo@x.com","role":"viewer"}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperado 201, veio %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_Routes_ConviteComPapelOwnerRetorna400(t *testing.T) {
	srv, _ := newRouteTestServer(rbac.RoleAdmin)

	rec := postInvite(t, srv, `{"email":"novo@x.com","role":"owner"}`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400, veio %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "INVALID_ROLE") {
		t.Fatalf("código INVALID_ROLE ausente: %s", rec.Body.String())
	}
}

func TestHandler_Membership_DevolvePapelEPermissoesDoRBAC(t *testing.T) {
	repo := newMockRepo()
	userID, orgID := uuid.New(), uuid.New()
	repo.orgs[orgID] = &organization.Organization{ID: orgID, Name: "Administradora X", Plan: "free"}
	m := &organization.Member{ID: uuid.New(), OrganizationID: orgID, UserID: userID, Role: organization.RoleEmployee}
	repo.members[m.ID] = m
	srv := buildRoutes(repo, rbac.RoleEmployee, userID, orgID)

	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/organizations/me/membership", nil))
	require.Equal(t, http.StatusOK, rec.Code)

	var resp struct {
		Data struct {
			Role         string   `json:"role"`
			Permissions  []string `json:"permissions"`
			Organization struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"organization"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, "employee", resp.Data.Role)
	assert.Equal(t, orgID.String(), resp.Data.Organization.ID)
	assert.Equal(t, "Administradora X", resp.Data.Organization.Name)
	assert.Contains(t, resp.Data.Permissions, "property:read")
	assert.NotContains(t, resp.Data.Permissions, "property:write")
}

func TestHandler_Membership_SemMembershipRetorna404(t *testing.T) {
	repo := newMockRepo()
	userID, orgID := uuid.New(), uuid.New()
	repo.orgs[orgID] = &organization.Organization{ID: orgID, Name: "Administradora X", Plan: "free"}
	srv := buildRoutes(repo, rbac.RoleViewer, userID, orgID)

	rec := httptest.NewRecorder()
	srv.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/organizations/me/membership", nil))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

package rbac_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
)

type fixedRoles struct {
	role rbac.RoleType
	err  error
}

func (f fixedRoles) RoleIn(context.Context, uuid.UUID, uuid.UUID) (rbac.RoleType, error) {
	return f.role, f.err
}

var okNext = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
})

func runMiddleware(roles rbac.MembershipRoles, perm rbac.Permission, ctx context.Context) *httptest.ResponseRecorder {
	mw := rbac.PermissionMiddleware(roles, perm)
	req := httptest.NewRequest(http.MethodPost, "/", nil).WithContext(ctx)
	rr := httptest.NewRecorder()
	mw(okNext).ServeHTTP(rr, req)
	return rr
}

func contextoDeMembro() context.Context {
	return auth.WithOwnerIDOrgID(context.Background(), uuid.New(), uuid.New())
}

func TestMiddleware_Returns401_WhenNoOwnerID(t *testing.T) {
	ctx := auth.WithOrganizationID(context.Background(), uuid.New())
	rr := runMiddleware(fixedRoles{role: rbac.RoleOwner}, rbac.PermissionPropertyWrite, ctx)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	assert.Contains(t, rr.Body.String(), "UNAUTHORIZED")
}

func TestMiddleware_Returns401_WhenNoOrgID(t *testing.T) {
	ctx := auth.WithOwnerID(context.Background(), uuid.New())
	rr := runMiddleware(fixedRoles{role: rbac.RoleOwner}, rbac.PermissionPropertyWrite, ctx)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	assert.Contains(t, rr.Body.String(), "NO_ORG")
}

func TestMiddleware_Returns403_QuandoOwnerFoiRebaixadoNoBanco(t *testing.T) {
	// O contexto não carrega papel: o banco diz viewer, então a escrita é negada.
	rr := runMiddleware(fixedRoles{role: "viewer"}, rbac.PermissionPropertyWrite, contextoDeMembro())

	assert.Equal(t, http.StatusForbidden, rr.Code)
	assert.Contains(t, rr.Body.String(), "FORBIDDEN")
}

func TestMiddleware_Returns403_QuandoMembroRemovido(t *testing.T) {
	rr := runMiddleware(fixedRoles{err: rbac.ErrNotMember}, rbac.PermissionPropertyRead, contextoDeMembro())

	assert.Equal(t, http.StatusForbidden, rr.Code)
	assert.Contains(t, rr.Body.String(), "FORBIDDEN")
}

func TestMiddleware_Returns500_QuandoBancoFalha(t *testing.T) {
	rr := runMiddleware(fixedRoles{err: errors.New("db down")}, rbac.PermissionPropertyRead, contextoDeMembro())

	assert.Equal(t, http.StatusInternalServerError, rr.Code)
	assert.Contains(t, rr.Body.String(), "ROLE_LOOKUP_FAILED")
	assert.NotContains(t, rr.Body.String(), "db down")
}

func TestMiddleware_PermissaoSegueOPapelDoBanco(t *testing.T) {
	cases := []struct {
		name string
		role rbac.RoleType
		perm rbac.Permission
		want int
	}{
		{"viewer lê propriedade", "viewer", rbac.PermissionPropertyRead, http.StatusOK},
		{"viewer não escreve propriedade", "viewer", rbac.PermissionPropertyWrite, http.StatusForbidden},
		{"admin escreve propriedade", rbac.RoleAdmin, rbac.PermissionPropertyWrite, http.StatusOK},
		{"employee não escreve pagamento", "employee", rbac.PermissionPaymentWrite, http.StatusForbidden},
		{"manager escreve pagamento", "manager", rbac.PermissionPaymentWrite, http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rr := runMiddleware(fixedRoles{role: tc.role}, tc.perm, contextoDeMembro())
			assert.Equal(t, tc.want, rr.Code)
		})
	}
}

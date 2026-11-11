package rbac

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

// ErrNotMember indica que o usuário não tem vínculo vigente com a organização.
var ErrNotMember = errors.New("usuário não é membro da organização")

// MembershipRoles resolve o papel atual do usuário na organização a partir do banco.
// É a fonte de verdade da autorização: o JWT não carrega papel. Retorna ErrNotMember sem vínculo.
type MembershipRoles interface {
	RoleIn(ctx context.Context, userID, orgID uuid.UUID) (RoleType, error)
}

func PermissionMiddleware(roles MembershipRoles, permission Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			userID := auth.OwnerIDFromCtx(ctx)
			if userID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
				return
			}

			orgID := auth.OrganizationIDFromCtx(ctx)
			if orgID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
				return
			}

			role, err := roles.RoleIn(ctx, userID, orgID)
			if errors.Is(err, ErrNotMember) {
				httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "sem vínculo vigente com a organização")
				return
			}
			if err != nil {
				httputil.Err(w, http.StatusInternalServerError, "ROLE_LOOKUP_FAILED", "erro ao verificar permissão")
				return
			}

			if !HasPermission(role, permission) {
				httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "sem permissão para esta ação")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

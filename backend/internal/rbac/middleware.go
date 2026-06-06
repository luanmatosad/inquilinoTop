package rbac

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

func PermissionMiddleware(permission Permission) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ownerID := auth.OwnerIDFromCtx(ctx)
			if ownerID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
				return
			}

			orgID := auth.OrganizationIDFromCtx(ctx)
			if orgID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
				return
			}

			roleStr := auth.RoleFromCtx(ctx)
			if roleStr == "" {
				httputil.Err(w, http.StatusForbidden, "NO_ROLE", "papel não encontrado")
				return
			}

			role := RoleType(roleStr)
			if !HasPermission(role, permission) {
				httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "sem permissão para esta ação")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RoleMiddleware(svc *Service, requiredRoles ...RoleType) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ownerID := auth.OwnerIDFromCtx(ctx)
			if ownerID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
				return
			}

			orgID := auth.OrganizationIDFromCtx(ctx)
			if orgID == uuid.Nil {
				httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
				return
			}

			roleStr := auth.RoleFromCtx(ctx)
			if roleStr == "" {
				httputil.Err(w, http.StatusForbidden, "NO_ROLE", "papel não encontrado")
				return
			}

			currentRole := RoleType(roleStr)
			hasRequiredRole := false
			for _, required := range requiredRoles {
				if currentRole == required {
					hasRequiredRole = true
					break
				}
				if currentRole == RoleOwner {
					hasRequiredRole = true
					break
				}
			}

			if !hasRequiredRole {
				httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "papel insuficiente")
				return
			}

			hasOrgRole, err := svc.CheckPermission(ctx, ownerID, currentRole, &orgID, nil)
			if err != nil || !hasOrgRole {
				httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "sem permissão na organização")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
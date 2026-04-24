package rbac

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func Middleware(svc *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			ownerID, ok := ctx.Value("owner_id").(uuid.UUID)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			roleStr := chi.URLParam(r, "role")
			if roleStr == "" {
				next.ServeHTTP(w, r)
				return
			}

			role := RoleType(roleStr)
			var propertyID *uuid.UUID
			if propStr := chi.URLParam(r, "property_id"); propStr != "" {
				id, err := uuid.Parse(propStr)
				if err == nil {
					propertyID = &id
				}
			}

			hasRole, err := svc.CheckPermission(ctx, ownerID, role, propertyID)
			if err != nil || !hasRole {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
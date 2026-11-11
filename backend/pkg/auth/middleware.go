package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/httputil"
)

type contextKey string

const (
	keyOwnerID contextKey = "owner_id"
	keyOrgID   contextKey = "organization_id"
	keyBranch  contextKey = "branch_id"
)

func Middleware(svc *JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httputil.Err(w, http.StatusUnauthorized, "MISSING_TOKEN", "token não fornecido")
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := svc.Verify(tokenStr)
			if err != nil {
				httputil.Err(w, http.StatusUnauthorized, "INVALID_TOKEN", "token inválido ou expirado")
				return
			}
			ctx := context.WithValue(r.Context(), keyOwnerID, claims.OwnerID)
			ctx = context.WithValue(ctx, keyOrgID, claims.OrganizationID)
			if claims.BranchID != nil {
				ctx = context.WithValue(ctx, keyBranch, *claims.BranchID)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OwnerIDFromCtx(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(keyOwnerID).(uuid.UUID)
	return id
}

func WithOwnerID(ctx context.Context, ownerID uuid.UUID) context.Context {
	return context.WithValue(ctx, keyOwnerID, ownerID)
}

func OrganizationIDFromCtx(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(keyOrgID).(uuid.UUID)
	return id
}

func WithOrganizationID(ctx context.Context, orgID uuid.UUID) context.Context {
	return context.WithValue(ctx, keyOrgID, orgID)
}

func WithOwnerIDOrgID(ctx context.Context, ownerID, orgID uuid.UUID) context.Context {
	return WithOrganizationID(WithOwnerID(ctx, ownerID), orgID)
}

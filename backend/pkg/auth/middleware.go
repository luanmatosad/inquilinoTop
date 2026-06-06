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
	keyRole    contextKey = "role"
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
			if claims.Role != "" {
				ctx = context.WithValue(ctx, keyRole, claims.Role)
			}
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

func OrganizationIDOrNil(ctx context.Context) *uuid.UUID {
	id := OrganizationIDFromCtx(ctx)
	if id == uuid.Nil {
		return nil
	}
	return &id
}

func WithOrganizationID(ctx context.Context, orgID uuid.UUID) context.Context {
	return context.WithValue(ctx, keyOrgID, orgID)
}

func RoleFromCtx(ctx context.Context) string {
	role, _ := ctx.Value(keyRole).(string)
	return role
}

func BranchIDFromCtx(ctx context.Context) *uuid.UUID {
	id, ok := ctx.Value(keyBranch).(uuid.UUID)
	if !ok {
		return nil
	}
	return &id
}

func WithBranchID(ctx context.Context, branchID uuid.UUID) context.Context {
	return context.WithValue(ctx, keyBranch, branchID)
}

func WithRole(ctx context.Context, role string) context.Context {
	return context.WithValue(ctx, keyRole, role)
}

func WithOwnerIDOrgID(ctx context.Context, ownerID, orgID uuid.UUID) context.Context {
	return WithOrganizationID(WithOwnerID(ctx, ownerID), orgID)
}

func WithOwnerIDOrgIDRole(ctx context.Context, ownerID, orgID uuid.UUID, role string) context.Context {
	return WithRole(WithOrganizationID(WithOwnerID(ctx, ownerID), orgID), role)
}

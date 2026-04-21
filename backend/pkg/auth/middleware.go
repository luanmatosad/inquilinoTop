package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/httputil"
)

type contextKey string

const ownerIDKey contextKey = "owner_id"

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
			ctx := context.WithValue(r.Context(), ownerIDKey, claims.OwnerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OwnerIDFromCtx(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(ownerIDKey).(uuid.UUID)
	return id
}

func WithOwnerID(ctx context.Context, ownerID uuid.UUID) context.Context {
	return context.WithValue(ctx, ownerIDKey, ownerID)
}

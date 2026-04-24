package ratelimit_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/ratelimit"
	"github.com/stretchr/testify/assert"
)

func TestMiddleware_AppliesUserRateLimitWhenAuthenticated(t *testing.T) {
	cfg := ratelimit.Config{
		IPRate:    100,
		IPBurst:   100,
		UserRate:  2,
		UserBurst: 2,
	}
	mw := ratelimit.NewMiddleware(cfg)

	ownerID := uuid.New()
	nextCalled := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled++
		w.WriteHeader(http.StatusOK)
	})

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req = req.WithContext(context.WithValue(req.Context(), "owner_id", ownerID))
		rr := httptest.NewRecorder()
		mw.Middleware(next).ServeHTTP(rr, req)
	}

	assert.Equal(t, 2, nextCalled, "após burst=2, a 3a requisição deve ser bloqueada")
}

func TestMiddleware_UsesIPRateLimitWhenNotAuthenticated(t *testing.T) {
	cfg := ratelimit.Config{
		IPRate:    100,
		IPBurst:   100,
		UserRate:  2,
		UserBurst: 2,
	}
	mw := ratelimit.NewMiddleware(cfg)

	nextCalled := 0
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled++
		w.WriteHeader(http.StatusOK)
	})

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rr := httptest.NewRecorder()
		mw.Middleware(next).ServeHTTP(rr, req)
	}

	assert.Equal(t, 3, nextCalled, "sem owner_id, deve usar rate limit de IP (burst alto)")
}
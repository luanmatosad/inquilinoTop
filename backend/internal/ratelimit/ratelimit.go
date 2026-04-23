package ratelimit

import (
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Limiter struct {
	mu       sync.RWMutex
	limiters map[string]*clientLimiter
	rate     float64
	burst    int
}

type clientLimiter struct {
	tokens    float64
	lastTick int64
}

func New(rate float64, burst int) *Limiter {
	rl := &Limiter{
		limiters: make(map[string]*clientLimiter),
		rate:     rate,
		burst:    burst,
	}
	go rl.cleanup()
	return rl
}

func (rl *Limiter) Allow(key string) bool {
	return rl.allow(key)
}

func (rl *Limiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now().UnixNano()
	limit, exists := rl.limiters[key]

	if !exists {
		rl.limiters[key] = &clientLimiter{
			tokens:    float64(rl.burst - 1),
			lastTick:  now,
		}
		return true
	}

	elapsed := now - limit.lastTick
	limit.tokens += float64(elapsed) * rl.rate / 1e9
	if limit.tokens > float64(rl.burst) {
		limit.tokens = float64(rl.burst)
	}

	limit.lastTick = now

	if limit.tokens < 1 {
		return false
	}

	limit.tokens--
	return true
}

func (rl *Limiter) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now().UnixNano()
		for key, limit := range rl.limiters {
			if now-limit.lastTick > 10*60*1e9 {
				delete(rl.limiters, key)
			}
		}
		rl.mu.Unlock()
	}
}

type RateLimiter interface {
	Allow(key string) bool
}

type Middleware struct {
	limiter     RateLimiter
	userLimiter RateLimiter
}

type Config struct {
	IPRate   float64
	IPBurst int
	UserRate float64
	UserBurst int
}

func NewMiddleware(cfg Config) *Middleware {
	return &Middleware{
		limiter:     New(cfg.IPRate, cfg.IPBurst),
		userLimiter: New(cfg.UserRate, cfg.UserBurst),
	}
}

func (m *Middleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getIP(r)
		userID := getUserID(r)

		var allow, userAllow bool

		if userID != "" {
			userAllow = m.userLimiter.Allow(userID)
			if !userAllow {
				w.Header().Set("X-RateLimit-Limit", "200")
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", "60")
				httputil.Err(w, http.StatusTooManyRequests, "USER_RATE_LIMIT_EXCEEDED", "limite de requisições excedido")
				return
			}
			w.Header().Set("X-RateLimit-Limit", "200")
			w.Header().Set("X-RateLimit-Remaining", "199")
			w.Header().Set("X-RateLimit-Reset", "60")
		} else {
			allow = m.limiter.Allow(ip)
			if !allow {
				w.Header().Set("X-RateLimit-Limit", "100")
				w.Header().Set("X-RateLimit-Remaining", "0")
				w.Header().Set("X-RateLimit-Reset", "60")
				httputil.Err(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "limite de requisições excedido")
				return
			}
			w.Header().Set("X-RateLimit-Limit", "100")
			w.Header().Set("X-RateLimit-Remaining", "99")
			w.Header().Set("X-RateLimit-Reset", "60")
		}

		next.ServeHTTP(w, r)
	})
}

func getIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

func getUserID(r *http.Request) string {
	return ""
}

type LimiterByID struct {
	limiters map[uuid.UUID]*Limiter
	mu       sync.RWMutex
	rate     float64
	burst    int
}

func NewByID(rate float64, burst int) *LimiterByID {
	return &LimiterByID{
		limiters: make(map[uuid.UUID]*Limiter),
		rate:     rate,
		burst:    burst,
	}
}

func (l *LimiterByID) Allow(key uuid.UUID) bool {
	l.mu.RLock()
	limiter, exists := l.limiters[key]
	l.mu.RUnlock()

	if !exists {
		l.mu.Lock()
		if _, exists = l.limiters[key]; !exists {
			l.limiters[key] = New(l.rate, l.burst)
		}
		limiter = l.limiters[key]
		l.mu.Unlock()
	}

	return limiter.Allow(key.String())
}
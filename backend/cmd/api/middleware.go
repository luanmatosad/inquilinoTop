package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/go-chi/chi/v5/middleware"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
	size   int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(b)
	r.size += n
	return n, err
}

func requestLoggerWithLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/health" {
				next.ServeHTTP(w, r)
				return
			}
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)

			status := rec.status
			if status == 0 {
				status = http.StatusOK
			}

			logger.InfoContext(r.Context(), "request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", status,
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", middleware.GetReqID(r.Context()),
				"remote_addr", r.RemoteAddr,
				"user_agent", r.UserAgent(),
				"bytes", rec.size,
			)
		})
	}
}

func requestLogger(next http.Handler) http.Handler {
	return requestLoggerWithLogger(slog.Default())(next)
}

// sentryHandler creates a performance transaction per request via sentryhttp.
// Repanic: true so our outer recover() can write the 500 response.
var sentryHandler = sentryhttp.New(sentryhttp.Options{Repanic: true})

func sentryMiddleware(next http.Handler) http.Handler {
	withTransaction := sentryHandler.Handle(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w}

		defer func() {
			if rv := recover(); rv != nil {
				// sentryhttp already captured the exception; we just write the response.
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}
			status := rec.status
			if status == 0 {
				status = http.StatusOK
			}
			if status >= 500 {
				hub := sentry.GetHubFromContext(r.Context())
				if hub != nil {
					hub.CaptureMessage(fmt.Sprintf("%s %s → %d", r.Method, r.URL.Path, status))
					sentry.Flush(2 * time.Second)
				}
			}
		}()

		withTransaction.ServeHTTP(rec, r)
	})
}

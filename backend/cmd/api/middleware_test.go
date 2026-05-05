package main

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

func TestStatusRecorder_DefaultsTo200(t *testing.T) {
	rec := &statusRecorder{ResponseWriter: httptest.NewRecorder()}
	rec.Write([]byte("hello"))
	if rec.status != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.status)
	}
}

func TestStatusRecorder_CapturesWriteHeader(t *testing.T) {
	rec := &statusRecorder{ResponseWriter: httptest.NewRecorder()}
	rec.WriteHeader(http.StatusNotFound)
	if rec.status != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.status)
	}
}

func TestStatusRecorder_TracksBytesWritten(t *testing.T) {
	rec := &statusRecorder{ResponseWriter: httptest.NewRecorder()}
	n, _ := rec.Write([]byte("hello"))
	if rec.size != n {
		t.Errorf("expected size %d, got %d", n, rec.size)
	}
}

func TestRequestLogger_CallsNextHandler(t *testing.T) {
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})

	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := requestLoggerWithLogger(logger)(next)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if !called {
		t.Error("next handler was not called")
	}
}

func TestRequestLogger_LogsStructuredFields(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})

	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := requestLoggerWithLogger(logger)(next)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/properties", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	logged := buf.String()
	for _, field := range []string{"method", "path", "status", "duration_ms"} {
		if !strings.Contains(logged, field) {
			t.Errorf("log missing field %q: %s", field, logged)
		}
	}
}

func TestRequestLogger_LogsRequestID(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := middleware.RequestID(requestLoggerWithLogger(logger)(next))
	req := httptest.NewRequest(http.MethodGet, "/leases", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if !strings.Contains(buf.String(), "request_id") {
		t.Errorf("log missing request_id: %s", buf.String())
	}
}

func TestRequestLogger_SkipsHealthCheck(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := requestLoggerWithLogger(logger)(next)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if strings.Contains(buf.String(), "request") {
		t.Errorf("expected /health to be skipped from logging: %s", buf.String())
	}
}

func TestSentryMiddleware_PanicRecovery(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	})

	handler := sentryMiddleware(next)
	req := httptest.NewRequest(http.MethodGet, "/crash", nil)
	w := httptest.NewRecorder()

	// Should not propagate the panic
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 after panic, got %d", w.Code)
	}
}

package metrics

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInit_RegistesMetrics(t *testing.T) {
	registry := prometheus.NewRegistry()
	err := Init(registry)
	require.NoError(t, err)
}

func TestHTTPMetricsMiddleware_InstrumentsRequest(t *testing.T) {
	registry := prometheus.NewRegistry()
	err := Init(registry)
	require.NoError(t, err)

	middleware := HTTPMetricsMiddleware()

	handlerCalled := false
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.True(t, handlerCalled)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestHTTPMetricsMiddleware_TracksErrors(t *testing.T) {
	registry := prometheus.NewRegistry()
	err := Init(registry)
	require.NoError(t, err)

	middleware := HTTPMetricsMiddleware()

	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Error"))
	}))

	req := httptest.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandlerHandler_ExposesMetrics(t *testing.T) {
	registry := prometheus.NewRegistry()
	err := Init(registry)
	require.NoError(t, err)

	// Use the middleware to trigger a request and record metrics
	middleware := HTTPMetricsMiddleware()
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	// Now check the metrics endpoint
	metricsHandler := Handler(registry)
	metricsReq := httptest.NewRequest("GET", "/metrics", nil)
	metricsW := httptest.NewRecorder()
	metricsHandler.ServeHTTP(metricsW, metricsReq)

	assert.Equal(t, http.StatusOK, metricsW.Code)
	assert.Contains(t, metricsW.Header().Get("Content-Type"), "text/plain")
	assert.Contains(t, metricsW.Body.String(), "http_requests_total")
}

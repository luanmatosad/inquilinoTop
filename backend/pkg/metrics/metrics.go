package metrics

import (
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal *prometheus.CounterVec
	httpRequestDuration *prometheus.HistogramVec
	httpRequestsInFlight prometheus.Gauge
)

func Init(registry prometheus.Registerer) error {
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path", "status"},
	)

	httpRequestsInFlight = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Number of HTTP requests in flight",
		},
	)

	if err := registry.Register(httpRequestsTotal); err != nil {
		return err
	}
	if err := registry.Register(httpRequestDuration); err != nil {
		return err
	}
	if err := registry.Register(httpRequestsInFlight); err != nil {
		return err
	}

	return nil
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *responseWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

func HTTPMetricsMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			httpRequestsInFlight.Inc()
			defer httpRequestsInFlight.Dec()

			writer := &responseWriter{ResponseWriter: w, status: 0}
			next.ServeHTTP(writer, r)

			duration := time.Since(start).Seconds()
			status := writer.status
			if status == 0 {
				status = http.StatusOK
			}

			httpRequestsTotal.WithLabelValues(r.Method, r.URL.Path, http.StatusText(status)).Inc()
			httpRequestDuration.WithLabelValues(r.Method, r.URL.Path, http.StatusText(status)).Observe(duration)
		})
	}
}

func Handler(registry prometheus.Gatherer) http.Handler {
	return promhttp.HandlerFor(registry, promhttp.HandlerOpts{})
}

package dashboard

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

// MetricsEnvelope documenta o envelope {data, error} de sucesso (apenas para Swagger).
type MetricsEnvelope struct {
	Data  Metrics        `json:"data"`
	Error *ErrorResponse `json:"error"`
}

// ErrorEnvelope documenta o envelope de erro {data: null, error} (apenas para Swagger).
type ErrorEnvelope struct {
	Data  interface{}   `json:"data"`
	Error ErrorResponse `json:"error"`
}

type ErrorResponse struct {
	Code    string `json:"code" example:"NO_ORG"`
	Message string `json:"message"`
}

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler, readMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/dashboard/metrics", h.metrics)
	})
}

// @Summary     Métricas agregadas do dashboard da organização
// @Tags        dashboard
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} MetricsEnvelope
// @Failure     401 {object} ErrorEnvelope "NO_ORG ou token ausente/inválido"
// @Failure     403 {object} ErrorEnvelope "papel sem permissão payment:read"
// @Failure     500 {object} ErrorEnvelope "METRICS_FAILED"
// @Router      /dashboard/metrics [get]
func (h *Handler) metrics(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	m, err := h.svc.GetMetrics(r.Context(), orgID)
	if err != nil {
		slog.Error("dashboard: get metrics failed", "org_id", orgID, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "METRICS_FAILED", "erro ao calcular métricas")
		return
	}
	httputil.OK(w, m)
}

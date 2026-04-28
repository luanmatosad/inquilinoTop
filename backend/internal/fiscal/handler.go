package fiscal

import (
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/fiscal/annual-report", h.AnnualReport)
}

// @Summary Relatório fiscal anual para DIRPF
// @Tags fiscal
// @Security BearerAuth
// @Produce json
// @Param year query int true "Ano (ex: 2026)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /fiscal/annual-report [get]
func (h *Handler) AnnualReport(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não autenticado")
		return
	}

	yearStr := r.URL.Query().Get("year")
	if yearStr == "" {
		httputil.Err(w, http.StatusBadRequest, "INVALID_YEAR", "year é obrigatório")
		return
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_YEAR", "year inválido")
		return
	}

	rep, err := h.svc.AnnualReport(r.Context(), ownerID, year)
	if err != nil {
		if strings.Contains(err.Error(), "year inválido") {
			httputil.Err(w, http.StatusBadRequest, "INVALID_YEAR", err.Error())
			return
		}
		slog.Error("fiscal: annual report failed", "owner_id", ownerID, "year", year, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "REPORT_FAILED", err.Error())
		return
	}
	httputil.OK(w, rep)
}
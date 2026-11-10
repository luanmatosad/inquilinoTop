package settings

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Register(r chi.Router, authMW, readMw, writeMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/settings/financial-rules", h.getFinancialRules)
		r.With(writeMw).Put("/settings/financial-rules", h.putFinancialRules)
	})
}

// @Summary Regras financeiras da organização (padrões para novos contratos e aviso de reajuste)
// @Tags settings
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /settings/financial-rules [get]
func (h *Handler) getFinancialRules(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	rules, err := h.svc.GetFinancialRules(r.Context(), orgID)
	if err != nil {
		slog.ErrorContext(r.Context(), "settings: ler regras financeiras", "error", err)
		httputil.Err(w, http.StatusInternalServerError, "SETTINGS_FAILED", "não foi possível ler as regras")
		return
	}
	httputil.OK(w, rules)
}

// @Summary Grava as regras financeiras da organização
// @Tags settings
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body FinancialRules true "Regras"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /settings/financial-rules [put]
func (h *Handler) putFinancialRules(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	var in FinancialRules
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	rules, err := h.svc.SaveFinancialRules(r.Context(), orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		if errors.Is(err, ErrInvalidRules) {
			httputil.Err(w, http.StatusBadRequest, "INVALID_RULES", "multa de 0 a 10%, juros de 0 a 5%, índice IGP-M ou IPCA e aviso de 1 a 180 dias")
			return
		}
		slog.ErrorContext(r.Context(), "settings: gravar regras financeiras", "error", err)
		httputil.Err(w, http.StatusInternalServerError, "SETTINGS_FAILED", "não foi possível gravar as regras")
		return
	}
	httputil.OK(w, rules)
}

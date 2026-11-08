package closing

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
		r.With(readMw).Get("/closings", h.get)
		r.With(writeMw).Post("/closings", h.closeMonth)
		r.With(writeMw).Post("/closings/{month}/reopen", h.reopen)
	})
}

func (h *Handler) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalidMonth):
		httputil.Err(w, http.StatusBadRequest, "INVALID_MONTH", "mês inválido, use AAAA-MM")
	case errors.Is(err, ErrInvalidReason):
		httputil.Err(w, http.StatusBadRequest, "INVALID_REASON", "informe o motivo da reabertura")
	case errors.Is(err, ErrMonthNotEnded):
		httputil.Err(w, http.StatusUnprocessableEntity, "MONTH_NOT_ENDED", "só é possível fechar meses já encerrados")
	case errors.Is(err, ErrAlreadyClosed):
		httputil.Err(w, http.StatusConflict, "ALREADY_CLOSED", "este mês já está fechado")
	case errors.Is(err, ErrNotClosed):
		httputil.Err(w, http.StatusConflict, "NOT_CLOSED", "este mês não está fechado")
	default:
		slog.Error("closing: operação falhou", "error", err)
		httputil.Err(w, http.StatusInternalServerError, "CLOSING_FAILED", "não foi possível concluir a operação")
	}
}

// @Summary Estado do mês (aberto com retrato ao vivo, ou fechado com o retrato gravado) e histórico
// @Tags closings
// @Security BearerAuth
// @Produce json
// @Param month query string true "Mês AAAA-MM"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /closings [get]
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	c, err := h.svc.Get(r.Context(), orgID, r.URL.Query().Get("month"))
	if err != nil {
		h.fail(w, err)
		return
	}
	httputil.OK(w, c)
}

// @Summary Fecha um mês já encerrado
// @Tags closings
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body map[string]string true "month: AAAA-MM"
// @Success 201 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 422 {object} map[string]interface{}
// @Router /closings [post]
func (h *Handler) closeMonth(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	var in struct {
		Month string `json:"month"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	c, err := h.svc.Close(r.Context(), orgID, auth.OwnerIDFromCtx(r.Context()), in.Month)
	if err != nil {
		h.fail(w, err)
		return
	}
	httputil.Created(w, c)
}

// @Summary Reabre um mês fechado (motivo obrigatório)
// @Tags closings
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param month path string true "Mês AAAA-MM"
// @Param body body map[string]string true "reason"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /closings/{month}/reopen [post]
func (h *Handler) reopen(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	var in struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	c, err := h.svc.Reopen(r.Context(), orgID, auth.OwnerIDFromCtx(r.Context()), chi.URLParam(r, "month"), in.Reason)
	if err != nil {
		h.fail(w, err)
		return
	}
	httputil.OK(w, c)
}

package settings

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
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
		r.With(readMw).Get("/settings/pix", h.getPix)
		r.With(writeMw).Put("/settings/pix", h.putPix)
		r.With(writeMw).Put("/settings/pix/units/{unitId}", h.putUnitPix)
		r.With(writeMw).Delete("/settings/pix/units/{unitId}", h.deleteUnitPix)
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

// pixOrg devolve a organização do contexto; responde 401 e devolve ok=false se faltar.
func pixOrg(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return uuid.Nil, false
	}
	return orgID, true
}

func pixFail(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidPixKey):
		httputil.Err(w, http.StatusBadRequest, "INVALID_PIX_KEY", "a chave não é válida para o tipo escolhido")
	case errors.Is(err, ErrInvalidPix):
		httputil.Err(w, http.StatusBadRequest, "INVALID_PIX", "o nome do recebedor vai até 25 caracteres e a cidade até 15")
	case errors.Is(err, ErrConfirmationRequired):
		httputil.Err(w, http.StatusBadRequest, "CONFIRMATION_REQUIRED", "confirme que o titular da chave autorizou receber os pagamentos desta unidade")
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade ou conta Pix não encontrada")
	default:
		slog.ErrorContext(r.Context(), "settings: pix", "error", err)
		httputil.Err(w, http.StatusInternalServerError, "SETTINGS_FAILED", "não foi possível concluir a operação")
	}
}

func unitIDParam(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "unitId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id da unidade inválido")
		return uuid.Nil, false
	}
	return id, true
}

// @Summary Chave Pix da organização e contas Pix por unidade
// @Tags settings
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /settings/pix [get]
func (h *Handler) getPix(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pixOrg(w, r)
	if !ok {
		return
	}
	p, err := h.svc.GetPix(r.Context(), orgID)
	if err != nil {
		pixFail(w, r, err)
		return
	}
	httputil.OK(w, p)
}

// @Summary Grava a chave Pix padrão da organização
// @Tags settings
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body PixInput true "Chave, tipo, nome e cidade"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /settings/pix [put]
func (h *Handler) putPix(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pixOrg(w, r)
	if !ok {
		return
	}
	var in PixInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	d, err := h.svc.SavePix(r.Context(), orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		pixFail(w, r, err)
		return
	}
	httputil.OK(w, d)
}

// @Summary Grava a conta Pix de uma unidade (exige confirmed=true)
// @Tags settings
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Param body body UnitPixInput true "Chave, tipo, nome e confirmação"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /settings/pix/units/{unitId} [put]
func (h *Handler) putUnitPix(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pixOrg(w, r)
	if !ok {
		return
	}
	unitID, ok := unitIDParam(w, r)
	if !ok {
		return
	}
	var in UnitPixInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	u, err := h.svc.SaveUnitPix(r.Context(), orgID, unitID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		pixFail(w, r, err)
		return
	}
	httputil.OK(w, u)
}

// @Summary Volta a unidade para a chave padrão (a conta fica no histórico)
// @Tags settings
// @Security BearerAuth
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /settings/pix/units/{unitId} [delete]
func (h *Handler) deleteUnitPix(w http.ResponseWriter, r *http.Request) {
	orgID, ok := pixOrg(w, r)
	if !ok {
		return
	}
	unitID, ok := unitIDParam(w, r)
	if !ok {
		return
	}
	if err := h.svc.RemoveUnitPix(r.Context(), orgID, unitID); err != nil {
		pixFail(w, r, err)
		return
	}
	httputil.OK(w, map[string]bool{"removed": true})
}

package lease

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
	"github.com/inquilinotop/api/pkg/validator"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler, readMw func(http.Handler) http.Handler, writeMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/leases", h.list)
		r.With(writeMw).Post("/leases", h.create)
		r.With(writeMw).Put("/leases/{id}", h.update)
		r.With(writeMw).Delete("/leases/{id}", h.delete)
		r.With(writeMw).Post("/leases/{id}/end", h.end)
		r.With(writeMw).Post("/leases/{id}/renew", h.renew)
		r.With(writeMw).Post("/leases/{id}/readjust", h.readjust)
		r.With(readMw).Get("/leases/{id}/readjustments", h.listReadjustments)
		r.Get("/indices/{type}/history", h.getIndexHistory)
		r.With(writeMw).Post("/leases/{id}/adjust", h.autoAdjust)
		r.With(readMw).Get("/leases/{id}", h.get)
	})
}

// @Summary Lista contratos
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /leases [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	list, err := h.svc.List(r.Context(), orgID)
	if err != nil {
		slog.Error("lease: list failed", "org_id", orgID, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Lease{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	var in CreateLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.Create(r.Context(), orgID, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, l)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	l, err := h.svc.Get(r.Context(), id, orgID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
			return
		}
		slog.Error("lease: get failed", "lease_id", id, "org_id", orgID, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

// @Summary Atualiza contrato
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body UpdateLeaseInput true "Dados do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in UpdateLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.Update(r.Context(), id, orgID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.Delete(r.Context(), id, orgID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

func (h *Handler) end(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	l, err := h.svc.End(r.Context(), id, orgID)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "END_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

func (h *Handler) renew(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in RenewLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.Renew(r.Context(), id, orgID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "RENEW_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

func (h *Handler) readjust(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in ReadjustInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	out, err := h.svc.Readjust(r.Context(), id, orgID, in)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPercentage):
			httputil.Err(w, http.StatusBadRequest, "INVALID_PERCENTAGE", "percentual inválido (esperado entre 0 e 1)")
		case errors.Is(err, ErrLeaseNotActive):
			httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", "contrato não ativo")
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
		default:
			httputil.Err(w, http.StatusInternalServerError, "READJUST_FAILED", err.Error())
		}
		return
	}
	httputil.OK(w, out)
}

// @Summary Lista reajustes de um contrato
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id}/readjustments [get]
func (h *Handler) listReadjustments(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	list, err := h.svc.ListReadjustments(r.Context(), id, orgID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Readjustment{}
	}
	httputil.OK(w, list)
}

// @Summary Lista histórico de um índice
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Param type path string true "Tipo do índice (IPCA, IGP-M)"
// @Success 200 {object} map[string]interface{}
// @Router /indices/{type}/history [get]
func (h *Handler) getIndexHistory(w http.ResponseWriter, r *http.Request) {
	indexType := chi.URLParam(r, "type")
	if indexType == "" {
		httputil.Err(w, http.StatusBadRequest, "INVALID_INDEX_TYPE", "tipo de índice inválido")
		return
	}

	list, err := h.svc.GetIndexHistory(r.Context(), indexType)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []IndexValue{}
	}
	httputil.OK(w, list)
}

// @Summary Aplica reajuste automático usando o índice mais recente
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body AdjustLeaseInput true "Dados para reajuste automático"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id}/adjust [post]
func (h *Handler) autoAdjust(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in AdjustLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	out, err := h.svc.AdjustByAutoIndex(r.Context(), id, orgID, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "AUTO_ADJUST_FAILED", err.Error())
		return
	}
	httputil.OK(w, out)
}

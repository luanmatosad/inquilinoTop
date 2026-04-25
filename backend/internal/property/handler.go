package property

import (
	"encoding/json"
	"errors"
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

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v1/properties", h.list)
	r.With(authMW).Post("/api/v1/properties", h.create)
	r.With(authMW).Get("/api/v1/properties/{id}", h.get)
	r.With(authMW).Put("/api/v1/properties/{id}", h.update)
	r.With(authMW).Delete("/api/v1/properties/{id}", h.delete)
	r.With(authMW).Get("/api/v1/properties/{id}/units", h.listUnits)
	r.With(authMW).Post("/api/v1/properties/{id}/units", h.createUnit)
	r.With(authMW).Get("/api/v1/units/{id}", h.getUnit)
	r.With(authMW).Put("/api/v1/units/{id}", h.updateUnit)
	r.With(authMW).Delete("/api/v1/units/{id}", h.deleteUnit)
}

// @Summary Lista imóveis
// @Tags properties
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /properties [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	list, err := h.svc.ListPropertiesWithUnits(r.Context(), ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []PropertyWithUnits{}
	}
	httputil.OK(w, list)
}

// @Summary Cria imóvel
// @Tags properties
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreatePropertyInput true "Dados do imóvel"
// @Success 201 {object} map[string]interface{}
// @Router /properties [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	var in CreatePropertyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	p, err := h.svc.CreateProperty(r.Context(), ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, p)
}

// @Summary Busca imóvel por ID
// @Tags properties
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do imóvel"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /properties/{id} [get]
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	p, err := h.svc.GetProperty(r.Context(), id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "imóvel não encontrado")
		return
	}
	units, err := h.svc.ListUnits(r.Context(), id)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_UNITS_FAILED", err.Error())
		return
	}
	resp := PropertyWithUnits{
		Property: *p,
		Units:    units,
	}
	httputil.OK(w, resp)
}

// @Summary Atualiza imóvel
// @Tags properties
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do imóvel"
// @Param body body CreatePropertyInput true "Dados do imóvel"
// @Success 200 {object} map[string]interface{}
// @Router /properties/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreatePropertyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	p, err := h.svc.UpdateProperty(r.Context(), id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
}

// @Summary Remove imóvel (soft-delete)
// @Tags properties
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do imóvel"
// @Success 200 {object} map[string]interface{}
// @Router /properties/{id} [delete]
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteProperty(r.Context(), id, ownerID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "imóvel não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

// @Summary Lista unidades de um imóvel
// @Tags units
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do imóvel"
// @Success 200 {object} map[string]interface{}
// @Router /properties/{id}/units [get]
func (h *Handler) listUnits(w http.ResponseWriter, r *http.Request) {
	propertyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	list, err := h.svc.ListUnits(r.Context(), propertyID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Unit{}
	}
	httputil.OK(w, list)
}

// @Summary Cria unidade em um imóvel
// @Tags units
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do imóvel"
// @Param body body CreateUnitInput true "Dados da unidade"
// @Success 201 {object} map[string]interface{}
// @Router /properties/{id}/units [post]
func (h *Handler) createUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	propertyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	u, err := h.svc.CreateUnit(r.Context(), propertyID, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_UNIT_FAILED", err.Error())
		return
	}
	httputil.Created(w, u)
}

// @Summary Busca unidade por ID
// @Tags units
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{id} [get]
func (h *Handler) getUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	u, err := h.svc.GetUnit(r.Context(), id, ownerID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}
	httputil.OK(w, u)
}

// @Summary Atualiza unidade
// @Tags units
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID da unidade"
// @Param body body CreateUnitInput true "Dados da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{id} [put]
func (h *Handler) updateUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	u, err := h.svc.UpdateUnit(r.Context(), id, ownerID, in)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "UPDATE_UNIT_FAILED", err.Error())
		return
	}
	httputil.OK(w, u)
}

// @Summary Remove unidade (soft-delete)
// @Tags units
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{id} [delete]
func (h *Handler) deleteUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteUnit(r.Context(), id, ownerID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_UNIT_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

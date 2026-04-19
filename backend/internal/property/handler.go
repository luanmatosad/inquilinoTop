package property

import (
	"encoding/json"
	"net/http"

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

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	list, err := h.svc.ListProperties(ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Property{}
	}
	httputil.OK(w, list)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	var in CreatePropertyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	p, err := h.svc.CreateProperty(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, p)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	p, err := h.svc.GetProperty(id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "imóvel não encontrado")
		return
	}
	httputil.OK(w, p)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreatePropertyInput
	json.NewDecoder(r.Body).Decode(&in)
	p, err := h.svc.UpdateProperty(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteProperty(id, ownerID); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

func (h *Handler) listUnits(w http.ResponseWriter, r *http.Request) {
	propertyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	list, err := h.svc.ListUnits(propertyID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Unit{}
	}
	httputil.OK(w, list)
}

func (h *Handler) createUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	propertyID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	json.NewDecoder(r.Body).Decode(&in)
	u, err := h.svc.CreateUnit(propertyID, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_UNIT_FAILED", err.Error())
		return
	}
	httputil.Created(w, u)
}

func (h *Handler) getUnit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	u, err := h.svc.GetUnit(id)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "unidade não encontrada")
		return
	}
	httputil.OK(w, u)
}

func (h *Handler) updateUnit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateUnitInput
	json.NewDecoder(r.Body).Decode(&in)
	u, err := h.svc.UpdateUnit(id, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_UNIT_FAILED", err.Error())
		return
	}
	httputil.OK(w, u)
}

func (h *Handler) deleteUnit(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.DeleteUnit(id); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_UNIT_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

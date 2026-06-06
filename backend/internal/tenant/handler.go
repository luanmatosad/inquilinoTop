package tenant

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

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler, readMw func(http.Handler) http.Handler, writeMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/tenants", h.list)
		r.With(writeMw).Post("/tenants", h.create)
		r.With(writeMw).Put("/tenants/{id}", h.update)
		r.With(writeMw).Delete("/tenants/{id}", h.delete)
		r.With(readMw).Get("/tenants/{id}", h.get)
	})
}

// @Summary Lista inquilinos
// @Tags tenants
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /tenants [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	list, err := h.svc.List(r.Context(), orgID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Tenant{}
	}
	httputil.OK(w, list)
}

// @Summary Cria inquilino
// @Tags tenants
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateTenantInput true "Dados do inquilino"
// @Success 201 {object} map[string]interface{}
// @Router /tenants [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}

	userID := auth.OwnerIDFromCtx(r.Context())
	orgID := auth.OrganizationIDFromCtx(r.Context())

	t, err := h.svc.Create(r.Context(), userID, orgID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, t)
}

// @Summary Busca inquilino por ID
// @Tags tenants
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do inquilino"
// @Success 200 {object} map[string]interface{}
// @Router /tenants/{id} [get]
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
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
	t, err := h.svc.Get(r.Context(), id, orgID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "inquilino não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}
	httputil.OK(w, t)
}

// @Summary Atualiza inquilino
// @Tags tenants
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do inquilino"
// @Param body body CreateTenantInput true "Dados do inquilino"
// @Success 200 {object} map[string]interface{}
// @Router /tenants/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
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
	var in CreateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	t, err := h.svc.Update(r.Context(), id, orgID, in)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "inquilino não encontrado")
			return
		}
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, t)
}

// @Summary Remove inquilino (soft-delete)
// @Tags tenants
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do inquilino"
// @Success 200 {object} map[string]interface{}
// @Router /tenants/{id} [delete]
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
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
	if err := h.svc.Delete(r.Context(), id, orgID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "inquilino não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

package expense

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
	r.With(authMW).Get("/expenses", h.listByOwner)
	r.With(authMW).Get("/units/{unitId}/expenses", h.listByUnit)
	r.With(authMW).Post("/units/{unitId}/expenses", h.create)
	r.With(authMW).Put("/expenses/{id}", h.update)
	r.With(authMW).Delete("/expenses/{id}", h.delete)
}

// @Summary Lista todas as despesas do owner autenticado
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /expenses [get]
func (h *Handler) listByOwner(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	list, err := h.svc.ListByOwner(r.Context(), ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Expense{}
	}
	httputil.OK(w, list)
}

// @Summary Lista despesas de uma unidade
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{unitId}/expenses [get]
func (h *Handler) listByUnit(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	unitID, err := uuid.Parse(chi.URLParam(r, "unitId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "unitId inválido")
		return
	}
	list, err := h.svc.ListByUnit(r.Context(), unitID, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Expense{}
	}
	httputil.OK(w, list)
}

// @Summary Cria despesa
// @Tags expenses
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Param body body CreateExpenseInput true "Dados da despesa"
// @Success 201 {object} map[string]interface{}
// @Router /units/{unitId}/expenses [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	unitID, err := uuid.Parse(chi.URLParam(r, "unitId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "unitId inválido")
		return
	}
	var in CreateExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	in.UnitID = unitID
	e, err := h.svc.Create(r.Context(), ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, e)
}

// @Summary Atualiza despesa
// @Tags expenses
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID da despesa"
// @Param body body CreateExpenseInput true "Dados da despesa"
// @Success 200 {object} map[string]interface{}
// @Router /expenses/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in CreateExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	e, err := h.svc.Update(r.Context(), id, ownerID, in)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "despesa não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, e)
}

// @Summary Remove despesa (soft-delete)
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da despesa"
// @Success 200 {object} map[string]interface{}
// @Router /expenses/{id} [delete]
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.Delete(r.Context(), id, ownerID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "despesa não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

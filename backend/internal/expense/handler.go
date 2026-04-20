package expense

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
	r.With(authMW).Get("/api/v1/units/{unitId}/expenses", h.listByUnit)
	r.With(authMW).Post("/api/v1/units/{unitId}/expenses", h.create)
	r.With(authMW).Put("/api/v1/expenses/{id}", h.update)
	r.With(authMW).Delete("/api/v1/expenses/{id}", h.delete)
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
	list, err := h.svc.ListByUnit(unitID, ownerID)
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
	in.UnitID = unitID
	e, err := h.svc.Create(ownerID, in)
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
	json.NewDecoder(r.Body).Decode(&in)
	e, err := h.svc.Update(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
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
	if err := h.svc.Delete(id, ownerID); err != nil {
		httputil.Err(w, http.StatusBadRequest, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

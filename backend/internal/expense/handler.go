package expense

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

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
		r.With(readMw).Get("/expenses", h.listByOwner)
		// /expenses/summary antes de /expenses/{id}: o chi dá precedência à rota estática, mas fica explícito.
		r.With(readMw).Get("/expenses/summary", h.summary)
		r.With(writeMw).Post("/expenses/{id}/pay", h.pay)
		r.With(writeMw).Post("/expenses/{id}/unpay", h.unpay)
		r.With(readMw).Get("/units/{unitId}/expenses", h.listByUnit)
		r.With(writeMw).Post("/units/{unitId}/expenses", h.create)
		r.With(writeMw).Put("/expenses/{id}", h.update)
		r.With(writeMw).Delete("/expenses/{id}", h.delete)
	})
}

// parseFilter lê status, from, to (YYYY-MM-DD) e unit_id da query string.
func parseFilter(r *http.Request) (ListFilter, error) {
	q := r.URL.Query()
	f := ListFilter{Status: q.Get("status")}
	parseDate := func(name string) (*time.Time, error) {
		v := q.Get(name)
		if v == "" {
			return nil, nil
		}
		t, err := time.Parse("2006-01-02", v)
		if err != nil {
			return nil, fmt.Errorf("%s inválido: use YYYY-MM-DD", name)
		}
		return &t, nil
	}
	var err error
	if f.From, err = parseDate("from"); err != nil {
		return f, err
	}
	if f.To, err = parseDate("to"); err != nil {
		return f, err
	}
	if v := q.Get("unit_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			return f, fmt.Errorf("unit_id inválido")
		}
		f.UnitID = &id
	}
	return f, nil
}

// @Summary Lista as despesas da organização
// @Description Filtros: status (PENDING a vencer | LATE vencida | PAID), from/to (vencimento, inclusive) e unit_id.
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param status query string false "PENDING, LATE ou PAID"
// @Param from query string false "Vencimento a partir de (YYYY-MM-DD)"
// @Param to query string false "Vencimento até (YYYY-MM-DD)"
// @Param unit_id query string false "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /expenses [get]
func (h *Handler) listByOwner(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	f, err := parseFilter(r)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_FILTER", err.Error())
		return
	}
	list, err := h.svc.List(r.Context(), orgID, f)
	if err != nil {
		if errors.Is(err, ErrInvalidFilter) {
			httputil.Err(w, http.StatusBadRequest, "INVALID_FILTER", "status inválido: use PENDING, LATE ou PAID")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Expense{}
	}
	httputil.OK(w, list)
}

// @Summary Resumo das despesas no período
// @Description Totais a vencer, vencidos e pagos, por vencimento entre from e to.
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param from query string false "Vencimento a partir de (YYYY-MM-DD)"
// @Param to query string false "Vencimento até (YYYY-MM-DD)"
// @Param unit_id query string false "ID da unidade"
// @Success 200 {object} Summary
// @Failure 400 {object} map[string]interface{}
// @Router /expenses/summary [get]
func (h *Handler) summary(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	f, err := parseFilter(r)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_FILTER", err.Error())
		return
	}
	sum, err := h.svc.Summary(r.Context(), orgID, f)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "SUMMARY_FAILED", err.Error())
		return
	}
	httputil.OK(w, sum)
}

// @Summary Dá baixa em uma despesa
// @Tags expenses
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID da despesa"
// @Param body body PayExpenseInput true "Data e valor pagos"
// @Success 200 {object} Expense
// @Failure 404 {object} map[string]interface{} "NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "EXPENSE_ALREADY_PAID"
// @Router /expenses/{id}/pay [post]
func (h *Handler) pay(w http.ResponseWriter, r *http.Request) {
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
	var in PayExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	e, err := h.svc.Pay(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		if writeDomainErr(w, err) {
			return
		}
		httputil.Err(w, http.StatusBadRequest, "PAY_FAILED", err.Error())
		return
	}
	httputil.OK(w, e)
}

// @Summary Estorna a baixa de uma despesa
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da despesa"
// @Success 200 {object} Expense
// @Failure 404 {object} map[string]interface{} "NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "EXPENSE_NOT_PAID"
// @Router /expenses/{id}/unpay [post]
func (h *Handler) unpay(w http.ResponseWriter, r *http.Request) {
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
	e, err := h.svc.Unpay(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()))
	if err != nil {
		if writeDomainErr(w, err) {
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "UNPAY_FAILED", err.Error())
		return
	}
	httputil.OK(w, e)
}

// writeDomainErr traduz erros de regra da despesa em HTTP; devolve false se err não for um deles.
func writeDomainErr(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "despesa não encontrada")
	case errors.Is(err, ErrAlreadyPaid):
		httputil.Err(w, http.StatusConflict, "EXPENSE_ALREADY_PAID", "a despesa já está paga")
	case errors.Is(err, ErrNotPaid):
		httputil.Err(w, http.StatusConflict, "EXPENSE_NOT_PAID", "a despesa não está paga")
	case errors.Is(err, ErrLocked):
		httputil.Err(w, http.StatusConflict, "EXPENSE_LOCKED", "despesa paga não aceita alterar valor ou vencimento; estorne a baixa antes")
	default:
		return false
	}
	return true
}

// @Summary Lista despesas de uma unidade
// @Tags expenses
// @Security BearerAuth
// @Produce json
// @Param unitId path string true "ID da unidade"
// @Success 200 {object} map[string]interface{}
// @Router /units/{unitId}/expenses [get]
func (h *Handler) listByUnit(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	unitID, err := uuid.Parse(chi.URLParam(r, "unitId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "unitId inválido")
		return
	}
	list, err := h.svc.ListByUnit(r.Context(), unitID, orgID)
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
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
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
	e, err := h.svc.Create(r.Context(), auth.OwnerIDFromCtx(r.Context()), orgID, in)
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
// @Failure 409 {object} map[string]interface{} "EXPENSE_LOCKED"
// @Router /expenses/{id} [put]
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
	var in CreateExpenseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	e, err := h.svc.Update(r.Context(), id, orgID, in)
	if err != nil {
		if writeDomainErr(w, err) {
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
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "despesa não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

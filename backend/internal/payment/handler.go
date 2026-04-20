package payment

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
	r.With(authMW).Get("/api/v1/leases/{leaseId}/payments", h.listByLease)
	r.With(authMW).Post("/api/v1/leases/{leaseId}/payments", h.create)
	r.With(authMW).Put("/api/v1/payments/{id}", h.update)
}

// @Summary Lista pagamentos de um contrato
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param leaseId path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{leaseId}/payments [get]
func (h *Handler) listByLease(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	list, err := h.svc.ListByLease(leaseID, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Payment{}
	}
	httputil.OK(w, list)
}

// @Summary Registra pagamento
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param leaseId path string true "ID do contrato"
// @Param body body CreatePaymentInput true "Dados do pagamento"
// @Success 201 {object} map[string]interface{}
// @Router /leases/{leaseId}/payments [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	var in CreatePaymentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	in.LeaseID = leaseID
	p, err := h.svc.Create(ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, p)
}

// @Summary Atualiza pagamento (ex: marcar como pago)
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do pagamento"
// @Param body body UpdatePaymentInput true "Dados do pagamento"
// @Success 200 {object} map[string]interface{}
// @Router /payments/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in UpdatePaymentInput
	json.NewDecoder(r.Body).Decode(&in)
	p, err := h.svc.Update(id, ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
}

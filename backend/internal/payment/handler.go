package payment

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
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
	r.With(authMW).Get("/api/v1/payments/{id}", h.get)
	r.With(authMW).Put("/api/v1/payments/{id}", h.update)
	r.With(authMW).Post("/api/v1/leases/{leaseId}/payments/generate", h.Generate)
	r.With(authMW).Get("/api/v1/payments/{id}/receipt", h.Receipt)
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
	list, err := h.svc.ListByLease(r.Context(), leaseID, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Payment{}
	}
	httputil.OK(w, list)
}

// @Summary Busca pagamento por ID
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 200 {object} map[string]interface{}
// @Router /payments/{id} [get]
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	p, err := h.svc.Get(r.Context(), id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
		return
	}
	httputil.OK(w, p)
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
	p, err := h.svc.Create(r.Context(), ownerID, in)
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
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	p, err := h.svc.Update(r.Context(), id, ownerID, in)
	if err != nil {
		if h.svc.IsAlreadyPaid(err) {
			httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "pagamento já foi registrado")
			return
		}
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
}

// @Summary Gera payments (RENT + eventual IPTU) da competência
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param leaseId path string true "ID do contrato"
// @Param month query string true "Competência YYYY-MM"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /leases/{leaseId}/payments/generate [post]
func (h *Handler) Generate(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	month := r.URL.Query().Get("month")
	if month == "" {
		httputil.Err(w, http.StatusBadRequest, "INVALID_MONTH", "query param month obrigatório")
		return
	}
	ps, err := h.svc.GenerateMonth(r.Context(), leaseID, ownerID, month)
	if err != nil {
		switch {
		case strings.Contains(err.Error(), "month"):
			httputil.Err(w, http.StatusBadRequest, "INVALID_MONTH", err.Error())
		case strings.Contains(err.Error(), "not active"):
			httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", err.Error())
		case strings.Contains(err.Error(), "iptu"):
			httputil.Err(w, http.StatusConflict, "IPTU_MISSING", err.Error())
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
		default:
			httputil.Err(w, http.StatusInternalServerError, "GENERATE_FAILED", err.Error())
		}
		return
	}
	httputil.Created(w, ps)
}

// @Summary Recibo mensal (status=PAID)
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Router /payments/{id}/receipt [get]
func (h *Handler) Receipt(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	rec, err := h.svc.BuildReceipt(r.Context(), id, ownerID)
	if err != nil {
		if h.svc.IsNotPaid(err) {
			httputil.Err(w, http.StatusConflict, "PAYMENT_NOT_PAID", "payment não está PAID")
			return
		}
		if strings.Contains(err.Error(), "not found") || errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "dados não encontrados")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "RECEIPT_FAILED", err.Error())
		return
	}
	httputil.OK(w, rec)
}

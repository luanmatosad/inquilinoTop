package payment

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/inquilinotop/api/pkg/validator"
	"github.com/inquilinotop/api/internal/payment/provider"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/leases/{leaseId}/payments", h.listByLease)
	r.With(authMW).Post("/leases/{leaseId}/payments", h.create)
	r.With(authMW).Get("/payments", h.listByOwner)
	r.With(authMW).Get("/payments/{id}", h.get)
	r.With(authMW).Put("/payments/{id}", h.update)
	r.With(authMW).Post("/leases/{leaseId}/payments/generate", h.Generate)
	r.With(authMW).Get("/payments/{id}/receipt", h.Receipt)
	r.With(authMW).Post("/payments/{id}/charge", h.handleCreateCharge)
	r.With(authMW).Get("/payments/{id}/charge", h.handleGetChargeStatus)
	r.With(authMW).Post("/payments/{id}/payout", h.handleCreatePayout)
	r.With(authMW).Get("/payments/config", h.getFinancialConfig)
	r.With(authMW).Put("/payments/config", h.updateFinancialConfig)
	
	r.Post("/webhook/{provider}", h.handleWebhook)
}

// @Summary Lista todos os pagamentos do owner autenticado
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param status query string false "Filtro de status (PENDING|PAID|LATE)"
// @Success 200 {object} map[string]interface{}
// @Router /payments [get]
func (h *Handler) listByOwner(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	statusFilter := r.URL.Query().Get("status")
	list, err := h.svc.ListByOwner(r.Context(), ownerID, statusFilter)
	if err != nil {
		slog.Error("payment: list by owner failed", "owner_id", ownerID, "status_filter", statusFilter, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Payment{}
	}
	httputil.OK(w, list)
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
		slog.Error("payment: list by lease failed", "lease_id", leaseID, "owner_id", ownerID, "error", err)
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
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
			return
		}
		slog.Error("payment: get failed", "payment_id", id, "owner_id", ownerID, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
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
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
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
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
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
		case errors.Is(err, ErrInvalidMonth):
			httputil.Err(w, http.StatusBadRequest, "INVALID_MONTH", "mês inválido (esperado YYYY-MM)")
		case errors.Is(err, ErrLeaseNotActive):
			httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", "contrato não ativo")
		case errors.Is(err, ErrIPTUMissing):
			httputil.Err(w, http.StatusConflict, "IPTU_MISSING", "IPTU não configurado")
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
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "dados não encontrados")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "RECEIPT_FAILED", err.Error())
		return
	}
	httputil.OK(w, rec)
}

type CreateChargeRequest struct {
	Method string `json:"method"`
}

func (h *Handler) handleCreateCharge(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())

	var req CreateChargeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}

	if req.Method != "PIX" && req.Method != "BOLETO" {
		httputil.Err(w, http.StatusBadRequest, "INVALID_METHOD", "method deve ser PIX ou BOLETO")
		return
	}

	resp, err := h.svc.CreateCharge(r.Context(), id, ownerID, req.Method)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "CREATE_CHARGE_FAILED", err.Error())
		return
	}

	httputil.OK(w, resp)
}

func (h *Handler) handleGetChargeStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())

	status, err := h.svc.GetChargeStatus(r.Context(), id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "GET_STATUS_FAILED", err.Error())
		return
	}

	httputil.OK(w, status)
}

type CreatePayoutRequest struct {
	Destination struct {
		Type        string `json:"type"`
		PixKey     string `json:"pix_key,omitempty"`
		PixKeyType string `json:"pix_key_type,omitempty"`
		OwnerName string `json:"owner_name"`
		Document  string `json:"document"`
	} `json:"destination"`
}

func (h *Handler) handleCreatePayout(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())

	var req CreatePayoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}

	dest := provider.Destination{
		Type:        req.Destination.Type,
		PixKey:     req.Destination.PixKey,
		PixKeyType: req.Destination.PixKeyType,
		OwnerName: req.Destination.OwnerName,
		Document:  req.Destination.Document,
	}

	resp, err := h.svc.CreatePayout(r.Context(), id, ownerID, dest)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "CREATE_PAYOUT_FAILED", err.Error())
		return
	}

	httputil.OK(w, resp)
}

func (h *Handler) handleWebhook(w http.ResponseWriter, r *http.Request) {
	providerName := chi.URLParam(r, "provider")

	webhookSecret := r.Header.Get("X-Webhook-Secret")
	if webhookSecret == "" {
		httputil.Err(w, http.StatusUnauthorized, "MISSING_SECRET", "X-Webhook-Secret header required")
		return
	}

	expectedSecret := os.Getenv("WEBHOOK_SECRET")
	if expectedSecret == "" {
		httputil.Err(w, http.StatusUnauthorized, "WEBHOOK_NOT_CONFIGURED", "webhook secret not configured")
		return
	}
	if webhookSecret != expectedSecret {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_SECRET", "invalid webhook secret")
		return
	}

	var event WebhookEvent
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}

	if err := validator.Validate(event); err != nil {
		httputil.ValidationErr(w, err)
		return
	}

	err := h.svc.ProcessWebhook(r.Context(), providerName, map[string]interface{}{
		"event":    event.Event,
		"chargeId": event.ChargeID,
	})
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "WEBHOOK_FAILED", err.Error())
		return
	}

	httputil.OK(w, map[string]string{"status": "ok"})
}

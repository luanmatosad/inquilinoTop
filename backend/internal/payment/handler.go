package payment

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/ratelimit"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/inquilinotop/api/pkg/validator"
)

type Handler struct {
	svc *Service
	// ipLimit e tokenLimit protegem as rotas públicas (ver RegisterPublic); nil usa os limites padrão.
	ipLimit    ratelimit.RateLimiter
	tokenLimit ratelimit.RateLimiter
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler, readMw func(http.Handler) http.Handler, writeMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/leases/{leaseId}/payments", h.listByLease)
		r.With(writeMw).Post("/leases/{leaseId}/payments", h.create)
		r.With(readMw).Get("/payments", h.listByOwner)
		r.With(readMw).Get("/payments/{id}", h.get)
		r.With(writeMw).Put("/payments/{id}", h.update)
		r.With(readMw).Get("/payments/{id}/receipt", h.Receipt)
		r.With(writeMw).Post("/payments/{id}/agreement", h.agreement)
		r.With(readMw).Get("/payments/{id}/pix", h.pixCode)
		r.With(writeMw).Post("/payments/{id}/link", h.createLink)
		r.With(readMw).Get("/payments/{id}/proof", h.proofFile)
		r.With(writeMw).Post("/payments/{id}/confirm-report", h.confirmReport)
		r.With(writeMw).Post("/payments/{id}/reject-report", h.rejectReport)
		r.With(readMw).Get("/payments/{id}/events", h.listEvents)
		r.With(writeMw).Post("/payments/{id}/events", h.recordEvent)
		r.With(readMw).Get("/payments/config", h.getFinancialConfig)
		r.With(writeMw).Put("/payments/config", h.updateFinancialConfig)
	})
	r.Post("/webhook/{provider}", h.handleWebhook)
}

// parseFilter lê status, from, to (YYYY-MM-DD) e lease_id da query string.
func parseFilter(r *http.Request) (PaymentFilter, error) {
	q := r.URL.Query()
	f := PaymentFilter{Status: q.Get("status")}
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
	if v := q.Get("lease_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			return f, fmt.Errorf("lease_id inválido")
		}
		f.LeaseID = &id
	}
	return f, nil
}

// @Summary Lista as cobranças da organização
// @Description Filtros: status (PENDING a vencer | LATE vencida, com multa e juros | PAID), from/to (vencimento, inclusive) e lease_id.
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param status query string false "PENDING, LATE ou PAID"
// @Param from query string false "Vencimento a partir de (YYYY-MM-DD)"
// @Param to query string false "Vencimento até (YYYY-MM-DD)"
// @Param lease_id query string false "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /payments [get]
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
		slog.Error("payment: list failed", "org_id", orgID, "error", err)
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
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	leaseID, err := uuid.Parse(chi.URLParam(r, "leaseId"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "leaseId inválido")
		return
	}
	list, err := h.svc.ListByLease(r.Context(), leaseID, orgID)
	if err != nil {
		slog.Error("payment: list by lease failed", "lease_id", leaseID, "org_id", orgID, "error", err)
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
	p, err := h.svc.Get(r.Context(), id, orgID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
			return
		}
		slog.Error("payment: get failed", "payment_id", id, "org_id", orgID, "error", err)
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
	orgID := auth.OrganizationIDFromCtx(r.Context())
	userID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if userID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "usuário não encontrado")
		return
	}
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
	p, err := h.svc.Create(r.Context(), userID, orgID, in)
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
	var in UpdatePaymentInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	p, err := h.svc.UpdateBy(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		if errors.Is(err, ErrInvalidDiscount) {
			httputil.Err(w, http.StatusBadRequest, "INVALID_DISCOUNT", "o desconto não pode passar do valor devido")
			return
		}
		if h.svc.IsAlreadyPaid(err) {
			httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "pagamento já foi registrado")
			return
		}
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, p)
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
	orgID := auth.OrganizationIDFromCtx(r.Context())
	userID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	rec, err := h.svc.BuildReceipt(r.Context(), id, orgID, userID)
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

// @Summary Linha do tempo da cobrança
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /payments/{id}/events [get]
func (h *Handler) listEvents(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.svc.Timeline(r.Context(), id, orgID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
			return
		}
		slog.Error("payment: timeline failed", "payment_id", id, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "EVENTS_FAILED", err.Error())
		return
	}
	httputil.OK(w, items)
}

// @Summary Registra o envio da cobrança (SENT ou REMINDER)
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do pagamento"
// @Param body body RecordEventInput true "Tipo e canal do envio"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "cobrança já paga"
// @Router /payments/{id}/events [post]
func (h *Handler) recordEvent(w http.ResponseWriter, r *http.Request) {
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
	var in RecordEventInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	e, err := h.svc.RecordEvent(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		switch {
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
		case errors.Is(err, ErrInvalidEvent):
			httputil.Err(w, http.StatusBadRequest, "INVALID_EVENT", "tipo ou canal inválido")
		case h.svc.IsAlreadyPaid(err):
			httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "a cobrança já está paga")
		default:
			slog.Error("payment: record event failed", "payment_id", id, "error", err)
			httputil.Err(w, http.StatusInternalServerError, "EVENT_FAILED", err.Error())
		}
		return
	}
	httputil.Created(w, e)
}

// @Summary Pix copia-e-cola da cobrança (valor atualizado do dia)
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "cobrança já paga"
// @Failure 422 {object} map[string]interface{} "PIX_KEY_NOT_CONFIGURED"
// @Router /payments/{id}/pix [get]
func (h *Handler) pixCode(w http.ResponseWriter, r *http.Request) {
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
	code, err := h.svc.PixPayload(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()))
	if err != nil {
		switch {
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
		case errors.Is(err, ErrPixKeyNotConfigured):
			httputil.Err(w, http.StatusUnprocessableEntity, "PIX_KEY_NOT_CONFIGURED", "cadastre a chave Pix em Configurações")
		case h.svc.IsAlreadyPaid(err):
			httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "a cobrança já está paga")
		default:
			slog.Error("payment: pix failed", "payment_id", id, "error", err)
			httputil.Err(w, http.StatusInternalServerError, "PIX_FAILED", err.Error())
		}
		return
	}
	httputil.OK(w, code)
}

// @Summary Acordo de atraso (nova data e valor combinado)
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do pagamento"
// @Param body body AgreementInput true "Nova data, valor combinado e observação"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{} "INVALID_AGREEMENT_DATE"
// @Failure 409 {object} map[string]interface{} "ALREADY_PAID ou PAYMENT_HAS_CHARGE"
// @Router /payments/{id}/agreement [post]
func (h *Handler) agreement(w http.ResponseWriter, r *http.Request) {
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
	var in AgreementInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	p, err := h.svc.Agree(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		switch {
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
		case errors.Is(err, ErrInvalidAgreementDate):
			httputil.Err(w, http.StatusBadRequest, "INVALID_AGREEMENT_DATE", "a nova data deve ser posterior a hoje")
		case errors.Is(err, ErrInvalidAgreement):
			httputil.Err(w, http.StatusBadRequest, "INVALID_AGREEMENT", "valor combinado inválido")
		case errors.Is(err, ErrPaymentHasCharge):
			httputil.Err(w, http.StatusConflict, "PAYMENT_HAS_CHARGE", "a cobrança já foi emitida pelo provedor")
		case h.svc.IsAlreadyPaid(err):
			httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "a cobrança já está paga")
		default:
			slog.Error("payment: agreement failed", "payment_id", id, "error", err)
			httputil.Err(w, http.StatusInternalServerError, "AGREEMENT_FAILED", err.Error())
		}
		return
	}
	httputil.OK(w, p)
}

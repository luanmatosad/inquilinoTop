package payment

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/ratelimit"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/inquilinotop/api/pkg/validator"
)

// WithPublicLimits troca os limites das rotas públicas (testes). ip vale por endereço; token, por link no "já paguei".
func (h *Handler) WithPublicLimits(ip, token ratelimit.RateLimiter) *Handler {
	h.ipLimit, h.tokenLimit = ip, token
	return h
}

// RegisterPublic registra as rotas sem login da página do inquilino. O link (token) é a única credencial.
func (h *Handler) RegisterPublic(r chi.Router) {
	if h.ipLimit == nil {
		h.ipLimit = ratelimit.New(0.5, 30) // 30 requisições por minuto por IP
	}
	if h.tokenLimit == nil {
		h.tokenLimit = ratelimit.New(5.0/3600, 5) // 5 avisos por hora por link
	}
	r.Group(func(r chi.Router) {
		r.Use(h.publicGuard)
		r.Get("/public/payments/{token}", h.publicView)
		r.Get("/public/payments/{token}/pix", h.publicPix)
		r.Get("/public/payments/{token}/receipt", h.publicReceipt)
		r.Post("/public/payments/{token}/report", h.publicReport)
	})
}

// publicGuard aplica o limite por IP e impede cache das respostas.
func (h *Handler) publicGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Robots-Tag", "noindex")
		if !h.ipLimit.Allow(clientIP(r)) {
			httputil.Err(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "muitas tentativas, tente de novo em instantes")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP segue o mesmo critério do middleware global: X-Forwarded-For, X-Real-IP e, por fim, o endereço da conexão.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	if rip := r.Header.Get("X-Real-IP"); rip != "" {
		return rip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// publicErr traduz erros das rotas públicas sem expor detalhes internos.
func (h *Handler) publicErr(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "link inválido ou expirado")
	case errors.Is(err, ErrPixKeyNotConfigured):
		httputil.Err(w, http.StatusUnprocessableEntity, "PIX_KEY_NOT_CONFIGURED", "o Pix desta cobrança não está disponível")
	case h.svc.IsAlreadyPaid(err):
		httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "a cobrança já está paga")
	case h.svc.IsNotPaid(err):
		httputil.Err(w, http.StatusConflict, "NOT_PAID", "o recibo fica disponível depois da confirmação")
	case errors.Is(err, ErrInvalidReport):
		httputil.Err(w, http.StatusBadRequest, "INVALID_REPORT", "valor inválido")
	case errors.Is(err, ErrInvalidPaidDate):
		httputil.Err(w, http.StatusBadRequest, "INVALID_PAID_DATE", "data do pagamento inválida")
	case errors.Is(err, ErrProofTooLarge):
		httputil.Err(w, http.StatusRequestEntityTooLarge, "PROOF_TOO_LARGE", "o comprovante deve ter até 5 MB")
	case errors.Is(err, ErrProofType):
		httputil.Err(w, http.StatusUnsupportedMediaType, "PROOF_TYPE_NOT_ALLOWED", "envie uma foto (JPEG, PNG) ou um PDF")
	default:
		slog.Error("payment: public route failed", "path", r.URL.Path, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "não foi possível concluir agora")
	}
}

// @Summary Cobrança pelo link público
// @Description Sem login. Devolve só o que o inquilino precisa ver; token inválido, expirado ou revogado dá 404 idêntico.
// @Tags public-payments
// @Produce json
// @Param token path string true "Token do link"
// @Success 200 {object} PublicView
// @Failure 404 {object} map[string]interface{}
// @Router /public/payments/{token} [get]
func (h *Handler) publicView(w http.ResponseWriter, r *http.Request) {
	v, err := h.svc.PublicView(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		h.publicErr(w, r, err)
		return
	}
	httputil.OK(w, v)
}

// @Summary Pix copia-e-cola pelo link público
// @Tags public-payments
// @Produce json
// @Param token path string true "Token do link"
// @Success 200 {object} PixCode
// @Failure 404 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "ALREADY_PAID"
// @Failure 422 {object} map[string]interface{} "PIX_KEY_NOT_CONFIGURED"
// @Router /public/payments/{token}/pix [get]
func (h *Handler) publicPix(w http.ResponseWriter, r *http.Request) {
	code, err := h.svc.PublicPix(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		h.publicErr(w, r, err)
		return
	}
	httputil.OK(w, code)
}

// @Summary Recibo pelo link público (sem documentos nem endereço)
// @Tags public-payments
// @Produce json
// @Param token path string true "Token do link"
// @Success 200 {object} Receipt
// @Failure 404 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "NOT_PAID"
// @Router /public/payments/{token}/receipt [get]
func (h *Handler) publicReceipt(w http.ResponseWriter, r *http.Request) {
	rec, err := h.svc.PublicReceipt(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		h.publicErr(w, r, err)
		return
	}
	httputil.OK(w, rec)
}

// parseAmount aceita "1850.00" e "1.850,00"-style simples ("1850,00").
func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", "."))
	return strconv.ParseFloat(s, 64)
}

// @Summary Inquilino avisa que pagou
// @Description Multipart: amount, paid_date (YYYY-MM-DD) e proof opcional (JPEG, PNG ou PDF até 5 MB). Limite de 5 avisos por hora por link.
// @Tags public-payments
// @Accept mpfd
// @Produce json
// @Param token path string true "Token do link"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{} "INVALID_REPORT ou INVALID_PAID_DATE"
// @Failure 409 {object} map[string]interface{} "ALREADY_PAID"
// @Failure 413 {object} map[string]interface{} "PROOF_TOO_LARGE"
// @Failure 415 {object} map[string]interface{} "PROOF_TYPE_NOT_ALLOWED"
// @Failure 429 {object} map[string]interface{} "RATE_LIMIT_EXCEEDED"
// @Router /public/payments/{token}/report [post]
func (h *Handler) publicReport(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	if !h.tokenLimit.Allow(hashToken(token)) {
		httputil.Err(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "muitos avisos neste link, tente mais tarde")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxProofBytes+(1<<20))
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			h.publicErr(w, r, ErrProofTooLarge)
			return
		}
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	defer r.MultipartForm.RemoveAll() //nolint:errcheck

	amount, err := parseAmount(r.FormValue("amount"))
	if err != nil {
		h.publicErr(w, r, ErrInvalidReport)
		return
	}
	date, err := time.Parse("2006-01-02", r.FormValue("paid_date"))
	if err != nil {
		h.publicErr(w, r, ErrInvalidPaidDate)
		return
	}

	var proof []byte
	file, _, err := r.FormFile("proof")
	switch {
	case err == nil:
		defer file.Close()
		if proof, err = io.ReadAll(io.LimitReader(file, MaxProofBytes+1)); err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "não foi possível ler o comprovante")
			return
		}
	case !errors.Is(err, http.ErrMissingFile):
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}

	if err := h.svc.ReportPaid(r.Context(), token, ReportInput{Amount: amount, PaidDate: date, Proof: proof}); err != nil {
		h.publicErr(w, r, err)
		return
	}
	httputil.OK(w, map[string]bool{"reported": true})
}

// @Summary Cria (ou rotaciona) o link público da cobrança
// @Description A URL com o token só aparece nesta resposta; o link anterior é revogado.
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 201 {object} LinkResult
// @Failure 404 {object} map[string]interface{}
// @Failure 422 {object} map[string]interface{} "PUBLIC_URL_NOT_CONFIGURED"
// @Router /payments/{id}/link [post]
func (h *Handler) createLink(w http.ResponseWriter, r *http.Request) {
	orgID, id, ok := h.orgAndID(w, r)
	if !ok {
		return
	}
	res, err := h.svc.CreateLink(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()))
	if err != nil {
		switch {
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
		case errors.Is(err, ErrPublicURLNotConfigured):
			httputil.Err(w, http.StatusUnprocessableEntity, "PUBLIC_URL_NOT_CONFIGURED", "APP_PUBLIC_URL não configurada")
		default:
			slog.Error("payment: create link failed", "payment_id", id, "error", err)
			httputil.Err(w, http.StatusInternalServerError, "LINK_FAILED", err.Error())
		}
		return
	}
	httputil.Created(w, res)
}

// orgAndID lê a organização do contexto e o id do path, respondendo o erro quando faltam.
func (h *Handler) orgAndID(w http.ResponseWriter, r *http.Request) (uuid.UUID, uuid.UUID, bool) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return uuid.Nil, uuid.Nil, false
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return uuid.Nil, uuid.Nil, false
	}
	return orgID, id, true
}

func (h *Handler) reportErr(w http.ResponseWriter, id uuid.UUID, op string, err error) {
	switch {
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "pagamento não encontrado")
	case errors.Is(err, ErrNoPendingReport):
		httputil.Err(w, http.StatusConflict, "NO_PENDING_REPORT", "a cobrança não tem aviso pendente")
	case h.svc.IsAlreadyPaid(err):
		httputil.Err(w, http.StatusConflict, "ALREADY_PAID", "a cobrança já está paga")
	case errors.Is(err, ErrInvalidDiscount):
		httputil.Err(w, http.StatusBadRequest, "INVALID_DISCOUNT", "desconto inválido")
	default:
		slog.Error("payment: "+op+" failed", "payment_id", id, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "REPORT_FAILED", err.Error())
	}
}

// @Summary Confirma o recebimento do aviso do inquilino
// @Description Baixa a cobrança como Pix na data informada pelo inquilino; desconto opcional.
// @Tags payments
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do pagamento"
// @Param body body ConfirmInput false "Desconto e observação"
// @Success 200 {object} Payment
// @Failure 409 {object} map[string]interface{} "NO_PENDING_REPORT ou ALREADY_PAID"
// @Router /payments/{id}/confirm-report [post]
func (h *Handler) confirmReport(w http.ResponseWriter, r *http.Request) {
	orgID, id, ok := h.orgAndID(w, r)
	if !ok {
		return
	}
	var in ConfirmInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil && !errors.Is(err, io.EOF) {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	p, err := h.svc.ConfirmReport(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		h.reportErr(w, id, "confirm report", err)
		return
	}
	httputil.OK(w, p)
}

// @Summary Recusa o aviso do inquilino ("ainda não recebi")
// @Tags payments
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do pagamento"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "NO_PENDING_REPORT ou ALREADY_PAID"
// @Router /payments/{id}/reject-report [post]
func (h *Handler) rejectReport(w http.ResponseWriter, r *http.Request) {
	orgID, id, ok := h.orgAndID(w, r)
	if !ok {
		return
	}
	if err := h.svc.RejectReport(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context())); err != nil {
		h.reportErr(w, id, "reject report", err)
		return
	}
	httputil.OK(w, map[string]bool{"rejected": true})
}

// @Summary Baixa o comprovante do aviso (só o dono)
// @Tags payments
// @Security BearerAuth
// @Param id path string true "ID do pagamento"
// @Success 200 {file} binary
// @Failure 404 {object} map[string]interface{}
// @Router /payments/{id}/proof [get]
func (h *Handler) proofFile(w http.ResponseWriter, r *http.Request) {
	orgID, id, ok := h.orgAndID(w, r)
	if !ok {
		return
	}
	rc, ctype, err := h.svc.ProofFile(r.Context(), id, orgID)
	if err != nil {
		h.reportErr(w, id, "proof", err)
		return
	}
	defer rc.Close()
	w.Header().Set("Content-Type", ctype)
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-store")
	_, _ = io.Copy(w, rc)
}

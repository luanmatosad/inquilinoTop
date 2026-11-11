package financial

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

// MaxBankCSVBytes limita o upload do extrato.
const MaxBankCSVBytes = 2 << 20

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Register: leitura com readMw (payment:read), gravação com writeMw (payment:write).
func (h *Handler) Register(r chi.Router, authMW, readMw, writeMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/financial/transfers", h.listTransfers)
		r.With(writeMw).Post("/financial/transfers/generate", h.generateTransfers)
		r.With(writeMw).Put("/financial/transfers/{id}", h.updateTransfer)
		r.With(readMw).Get("/financial/bank-records", h.listBankRecords)
		r.With(writeMw).Post("/financial/bank-records/import", h.importBankRecords)
		r.With(readMw).Get("/financial/admin-fee", h.getAdminFee)
		r.With(writeMw).Put("/financial/admin-fee", h.putAdminFee)
	})
}

// @Summary     Lista repasses da organização
// @Tags        financial
// @Security    BearerAuth
// @Produce     json
// @Param       status      query string false "PENDING | PROCESSED | TRANSFERRED"
// @Param       from        query string false "competência inicial YYYY-MM"
// @Param       to          query string false "competência final YYYY-MM"
// @Param       property_id query string false "UUID do imóvel"
// @Success     200 {object} map[string]interface{}
// @Failure     400 {object} map[string]interface{} "INVALID_PERIOD | INVALID_PROPERTY_ID"
// @Router      /financial/transfers [get]
func (h *Handler) listTransfers(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	f := TransferFilter{
		Status: r.URL.Query().Get("status"),
		From:   r.URL.Query().Get("from"),
		To:     r.URL.Query().Get("to"),
	}
	if raw := r.URL.Query().Get("property_id"); raw != "" {
		pid, err := uuid.Parse(raw)
		if err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_PROPERTY_ID", "property_id inválido")
			return
		}
		f.PropertyID = &pid
	}
	list, err := h.svc.ListTransfers(r.Context(), orgID, f)
	if err != nil {
		writeErr(w, r, err, "LIST_TRANSFERS_FAILED")
		return
	}
	httputil.OK(w, list)
}

type generateInput struct {
	Period string `json:"period"`
}

// @Summary     Gera repasses PENDING da competência (idempotente)
// @Tags        financial
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body body generateInput true "competência YYYY-MM"
// @Success     200 {object} map[string]interface{}
// @Failure     400 {object} map[string]interface{} "INVALID_PERIOD"
// @Router      /financial/transfers/generate [post]
func (h *Handler) generateTransfers(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	var in generateInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	n, err := h.svc.GenerateTransfers(r.Context(), orgID, in.Period)
	if err != nil {
		writeErr(w, r, err, "GENERATE_TRANSFERS_FAILED")
		return
	}
	httputil.OK(w, map[string]int{"created": n})
}

type updateTransferBody struct {
	Status    *string  `json:"status"`
	Discounts *float64 `json:"discounts"`
}

// @Summary     Avança o status do repasse ou altera descontos (PENDING)
// @Tags        financial
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       id   path string             true "UUID do repasse"
// @Param       body body updateTransferBody true "status e/ou discounts"
// @Success     200 {object} map[string]interface{}
// @Failure     400 {object} map[string]interface{} "INVALID_DISCOUNTS | DISCOUNTS_EXCEED_GROSS"
// @Failure     404 {object} map[string]interface{} "NOT_FOUND"
// @Failure     409 {object} map[string]interface{} "INVALID_TRANSITION | TRANSFER_LOCKED | CONCURRENT_UPDATE"
// @Router      /financial/transfers/{id} [put]
func (h *Handler) updateTransfer(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var body updateTransferBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	t, err := h.svc.UpdateTransfer(r.Context(), orgID, id, UpdateTransferInput{Status: body.Status, Discounts: body.Discounts})
	if err != nil {
		writeErr(w, r, err, "UPDATE_TRANSFER_FAILED")
		return
	}
	httputil.OK(w, t)
}

// @Summary     Lê a taxa administrativa da organização (%)
// @Tags        financial
// @Security    BearerAuth
// @Produce     json
// @Success     200 {object} map[string]interface{}
// @Router      /financial/admin-fee [get]
func (h *Handler) getAdminFee(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	pct, err := h.svc.GetAdminFeePercent(r.Context(), orgID)
	if err != nil {
		writeErr(w, r, err, "GET_ADMIN_FEE_FAILED")
		return
	}
	httputil.OK(w, map[string]float64{"admin_fee_percent": pct})
}

type adminFeeInput struct {
	AdminFeePercent float64 `json:"admin_fee_percent"`
}

// @Summary     Grava a taxa administrativa da organização (0 a 100)
// @Tags        financial
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body body adminFeeInput true "taxa em percentual"
// @Success     200 {object} map[string]interface{}
// @Failure     400 {object} map[string]interface{} "INVALID_BODY | INVALID_ADMIN_FEE"
// @Router      /financial/admin-fee [put]
func (h *Handler) putAdminFee(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	var in adminFeeInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := h.svc.SetAdminFeePercent(r.Context(), orgID, in.AdminFeePercent); err != nil {
		writeErr(w, r, err, "SET_ADMIN_FEE_FAILED")
		return
	}
	// Devolve o valor efetivamente gravado (arredondado).
	pct, err := h.svc.GetAdminFeePercent(r.Context(), orgID)
	if err != nil {
		writeErr(w, r, err, "SET_ADMIN_FEE_FAILED")
		return
	}
	httputil.OK(w, map[string]float64{"admin_fee_percent": pct})
}

// @Summary     Lista lançamentos do extrato importado
// @Tags        financial
// @Security    BearerAuth
// @Produce     json
// @Param       from query string false "data inicial YYYY-MM-DD"
// @Param       to   query string false "data final YYYY-MM-DD"
// @Success     200 {object} map[string]interface{}
// @Failure     400 {object} map[string]interface{} "INVALID_DATE"
// @Router      /financial/bank-records [get]
func (h *Handler) listBankRecords(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	var f BankRecordFilter
	if raw := r.URL.Query().Get("from"); raw != "" {
		d, err := time.Parse("2006-01-02", raw)
		if err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_DATE", "from inválido (YYYY-MM-DD)")
			return
		}
		f.From = &d
	}
	if raw := r.URL.Query().Get("to"); raw != "" {
		d, err := time.Parse("2006-01-02", raw)
		if err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_DATE", "to inválido (YYYY-MM-DD)")
			return
		}
		f.To = &d
	}
	list, err := h.svc.ListBankRecords(r.Context(), orgID, f)
	if err != nil {
		writeErr(w, r, err, "LIST_BANK_RECORDS_FAILED")
		return
	}
	httputil.OK(w, list)
}

// @Summary     Importa extrato CSV (date,description,amount,type)
// @Tags        financial
// @Security    BearerAuth
// @Accept      multipart/form-data
// @Produce     json
// @Param       file formData file true "arquivo CSV"
// @Success     200 {object} map[string]interface{}
// @Failure     400 {object} map[string]interface{} "INVALID_FILE | INVALID_CSV_FORMAT"
// @Router      /financial/bank-records/import [post]
func (h *Handler) importBankRecords(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxBankCSVBytes+(1<<10))
	file, _, err := r.FormFile("file")
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_FILE", "envie o CSV no campo 'file' (máx. 2 MB)")
		return
	}
	defer file.Close()

	rows, err := ParseBankCSV(file)
	if err != nil {
		writeErr(w, r, err, "IMPORT_FAILED")
		return
	}
	res, err := h.svc.ImportBankRecords(r.Context(), orgID, rows)
	if err != nil {
		writeErr(w, r, err, "IMPORT_FAILED")
		return
	}
	httputil.OK(w, res)
}

// writeErr mapeia erros de domínio para HTTP; qualquer outro vira 500 com o código informado.
func writeErr(w http.ResponseWriter, r *http.Request, err error, internalCode string) {
	switch {
	case errors.Is(err, ErrInvalidPeriod):
		httputil.Err(w, http.StatusBadRequest, "INVALID_PERIOD", "período deve ser YYYY-MM")
	case errors.Is(err, ErrInvalidDiscounts):
		httputil.Err(w, http.StatusBadRequest, "INVALID_DISCOUNTS", "descontos não podem ser negativos")
	case errors.Is(err, ErrInvalidAdminFee):
		httputil.Err(w, http.StatusBadRequest, "INVALID_ADMIN_FEE", "taxa deve estar entre 0 e 100")
	case errors.Is(err, ErrDiscountsExceedGross):
		httputil.Err(w, http.StatusBadRequest, "DISCOUNTS_EXCEED_GROSS", "descontos maiores que o valor recebido")
	case errors.Is(err, ErrInvalidCSV):
		httputil.Err(w, http.StatusBadRequest, "INVALID_CSV_FORMAT", err.Error())
	case errors.Is(err, ErrInvalidTransition):
		httputil.Err(w, http.StatusConflict, "INVALID_TRANSITION", "transição de status não permitida")
	case errors.Is(err, ErrTransferLocked):
		httputil.Err(w, http.StatusConflict, "TRANSFER_LOCKED", "descontos só podem mudar enquanto o repasse está pendente")
	case errors.Is(err, ErrConcurrentUpdate):
		httputil.Err(w, http.StatusConflict, "CONCURRENT_UPDATE", "repasse alterado por outra requisição; recarregue")
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "repasse não encontrado")
	default:
		slog.Error("financial: request failed", "code", internalCode, "path", r.URL.Path, "error", err)
		httputil.Err(w, http.StatusInternalServerError, internalCode, "erro interno")
	}
}

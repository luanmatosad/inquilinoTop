package lease

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
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
		r.With(readMw).Get("/leases", h.list)
		r.With(writeMw).Post("/leases", h.create)
		r.With(writeMw).Put("/leases/{id}", h.update)
		r.With(writeMw).Delete("/leases/{id}", h.delete)
		r.With(writeMw).Post("/leases/{id}/end", h.end)
		r.With(writeMw).Post("/leases/{id}/renew", h.renew)
		r.With(writeMw).Post("/leases/{id}/readjust", h.readjust)
		r.With(readMw).Get("/leases/{id}/readjustments", h.listReadjustments)
		r.With(readMw).Get("/leases/{id}", h.get)
	})
}

// @Summary Lista contratos
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /leases [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	list, err := h.svc.List(r.Context(), orgID)
	if err != nil {
		slog.Error("lease: list failed", "org_id", orgID, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Lease{}
	}
	httputil.OK(w, list)
}

// @Summary Cria contrato
// @Description Valida datas, unidade/inquilino da organização e sobreposição; com generate_payments gera até 12 cobranças.
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateLeaseInput true "Dados do contrato"
// @Success 201 {object} CreateOutput
// @Failure 404 {object} map[string]interface{} "UNIT_NOT_FOUND | TENANT_NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "LEASE_OVERLAP"
// @Failure 422 {object} map[string]interface{} "INVALID_DATES"
// @Router /leases [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	var in CreateLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.Create(r.Context(), orgID, ownerID, in)
	if err != nil {
		if writeDomainErr(w, err) {
			return
		}
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, l)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	l, err := h.svc.Get(r.Context(), id, orgID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
			return
		}
		slog.Error("lease: get failed", "lease_id", id, "org_id", orgID, "error", err)
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

// @Summary Atualiza contrato
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body UpdateLeaseInput true "Dados do contrato"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "LEASE_OVERLAP | STATUS_CHANGE_NOT_ALLOWED"
// @Failure 422 {object} map[string]interface{} "INVALID_DATES"
// @Router /leases/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in UpdateLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.Update(r.Context(), id, orgID, in)
	if err != nil {
		if writeDomainErr(w, err) {
			return
		}
		httputil.Err(w, http.StatusBadRequest, "UPDATE_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	if err := h.svc.Delete(r.Context(), id, orgID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

// @Summary Encerra contrato
// @Description Encerra um contrato ACTIVE e retira as cobranças futuras pendentes sem cobrança emitida a partir da data de saída. O corpo é opcional: sem ele, a saída é hoje e sem motivo.
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body EndLeaseInput false "Data de saída e motivo (opcionais)"
// @Success 200 {object} EndOutput
// @Failure 400 {object} map[string]interface{} "INVALID_BODY, motivo inválido"
// @Failure 422 {object} map[string]interface{} "INVALID_DATES (saída antes do início)"
// @Failure 404 {object} map[string]interface{} "NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "LEASE_NOT_ACTIVE"
// @Router /leases/{id}/end [post]
func (h *Handler) end(w http.ResponseWriter, r *http.Request) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "owner não encontrado")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	var in EndLeaseInput
	// Corpo opcional: vazio (EOF) mantém o comportamento antigo; qualquer outra coisa precisa ser JSON válido.
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil && !errors.Is(err, io.EOF) {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.End(r.Context(), id, orgID, in)
	if err != nil {
		if writeDomainErr(w, err) {
			return
		}
		httputil.Err(w, http.StatusBadRequest, "END_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

// @Summary Renova contrato
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body RenewLeaseInput true "Nova data final"
// @Success 200 {object} Lease
// @Failure 404 {object} map[string]interface{} "NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "LEASE_NOT_ACTIVE | LEASE_OVERLAP"
// @Failure 422 {object} map[string]interface{} "INVALID_DATES"
// @Router /leases/{id}/renew [post]
func (h *Handler) renew(w http.ResponseWriter, r *http.Request) {
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
	var in RenewLeaseInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	l, err := h.svc.Renew(r.Context(), id, orgID, in)
	if err != nil {
		if writeDomainErr(w, err) {
			return
		}
		httputil.Err(w, http.StatusBadRequest, "RENEW_FAILED", err.Error())
		return
	}
	httputil.OK(w, l)
}

// @Summary Reajusta o aluguel do contrato
// @Description Aplica um percentual (fração: 0,05 = 5%) ao aluguel de um contrato ACTIVE, registra o histórico e passa as cobranças de aluguel (RENT) futuras pendentes, sem cobrança emitida e com vencimento a partir da data de vigência, ao novo valor. Cobranças pagas, de IPTU, anteriores à vigência ou já emitidas não mudam; as emitidas são contadas em payments_need_review. Se atualizar as cobranças falhar, o reajuste do contrato vale e payments_error informa.
// @Tags leases
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do contrato"
// @Param body body ReadjustInput true "Percentual, data de vigência e índice"
// @Success 200 {object} ReadjustOutput
// @Failure 400 {object} map[string]interface{} "INVALID_BODY, percentual inválido"
// @Failure 409 {object} map[string]interface{} "LEASE_NOT_ACTIVE"
// @Router /leases/{id}/readjust [post]
func (h *Handler) readjust(w http.ResponseWriter, r *http.Request) {
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
	var in ReadjustInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	out, err := h.svc.Readjust(r.Context(), id, orgID, in)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidPercentage):
			httputil.Err(w, http.StatusBadRequest, "INVALID_PERCENTAGE", "percentual inválido (esperado entre 0 e 1)")
		case errors.Is(err, ErrLeaseNotActive):
			httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", "contrato não ativo")
		case errors.Is(err, apierr.ErrNotFound):
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
		default:
			httputil.Err(w, http.StatusInternalServerError, "READJUST_FAILED", err.Error())
		}
		return
	}
	httputil.OK(w, out)
}

// @Summary Lista reajustes de um contrato
// @Tags leases
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do contrato"
// @Success 200 {object} map[string]interface{}
// @Router /leases/{id}/readjustments [get]
func (h *Handler) listReadjustments(w http.ResponseWriter, r *http.Request) {
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
	list, err := h.svc.ListReadjustments(r.Context(), id, orgID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Readjustment{}
	}
	httputil.OK(w, list)
}

// writeDomainErr traduz erros de regra do contrato em HTTP; devolve false se err não for um deles.
func writeDomainErr(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, ErrInvalidDates):
		httputil.Err(w, http.StatusUnprocessableEntity, "INVALID_DATES", "a data final deve ser posterior à data inicial")
	case errors.Is(err, ErrLeaseOverlap):
		httputil.Err(w, http.StatusConflict, "LEASE_OVERLAP", "a unidade já tem contrato ativo no período")
	case errors.Is(err, ErrLeaseNotActive):
		httputil.Err(w, http.StatusConflict, "LEASE_NOT_ACTIVE", "contrato não ativo")
	case errors.Is(err, ErrStatusChange):
		httputil.Err(w, http.StatusConflict, "STATUS_CHANGE_NOT_ALLOWED", "o status só muda por encerrar ou renovar")
	case errors.Is(err, ErrUnitNotFound):
		httputil.Err(w, http.StatusNotFound, "UNIT_NOT_FOUND", "unidade não encontrada")
	case errors.Is(err, ErrTenantNotFound):
		httputil.Err(w, http.StatusNotFound, "TENANT_NOT_FOUND", "inquilino não encontrado")
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "contrato não encontrado")
	default:
		return false
	}
	return true
}

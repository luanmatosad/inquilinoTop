package support

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
	r.With(authMW).Get("/tickets", h.list)
	r.With(authMW).Post("/tickets", h.create)
	r.With(authMW).Get("/tickets/{id}", h.getByID)
}

// @Summary Lista tickets do usuário
// @Tags support
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /tickets [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	tickets, err := h.svc.ListByUser(r.Context(), userID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if tickets == nil {
		tickets = []Ticket{}
	}
	httputil.OK(w, tickets)
}

// @Summary Cria ticket de suporte
// @Tags support
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateTicketInput true "Dados do ticket"
// @Success 201 {object} map[string]interface{}
// @Router /tickets [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	var in CreateTicketInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}
	ticket, err := h.svc.Create(r.Context(), userID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}
	httputil.Created(w, ticket)
}

// @Summary Busca ticket por ID
// @Tags support
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do ticket"
// @Success 200 {object} map[string]interface{}
// @Router /tickets/{id} [get]
func (h *Handler) getByID(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}
	ticket, err := h.svc.Get(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "ticket não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}
	httputil.OK(w, ticket)
}
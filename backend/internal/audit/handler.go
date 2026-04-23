package audit

import (
	"encoding/json"
	"net/http"
	"time"

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

type ListInput struct {
	From      *string `json:"from,omitempty"`
	To        *string `json:"to,omitempty"`
	EventType *string `json:"event_type,omitempty"`
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Group(func(r chi.Router) {
		r.Get("/audit-logs", h.list)
	})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
		return
	}

	var input ListInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}

	var from, to *time.Time
	if input.From != nil {
		t, err := time.Parse(time.RFC3339, *input.From)
		if err == nil {
			from = &t
		}
	}
	if input.To != nil {
		t, err := time.Parse(time.RFC3339, *input.To)
		if err == nil {
			to = &t
		}
	}

	var eventType *string
	if input.EventType != nil && *input.EventType != "" {
		eventType = input.EventType
	}

	logs, err := h.svc.ListLogs(r.Context(), ownerID, from, to, eventType)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "erro interno")
		return
	}

	httputil.OK(w, map[string]interface{}{
		"logs": logs,
	})
}
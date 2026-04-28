package notification

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
	r.With(authMW).Get("/api/v1/notifications", h.list)
	r.With(authMW).Post("/api/v1/notifications", h.create)
	r.With(authMW).Get("/api/v1/notifications/{id}", h.get)
	r.With(authMW).Post("/api/v1/notifications/process", h.processQueue)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}

	notifications, err := h.svc.ListByOwner(r.Context(), ownerID, status)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if notifications == nil {
		notifications = []Notification{}
	}
	httputil.OK(w, notifications)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())

	var in CreateNotificationInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}

	n, err := h.svc.CreateNotification(r.Context(), ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "CREATE_FAILED", err.Error())
		return
	}

	httputil.Created(w, n)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}

	n, err := h.svc.GetNotification(r.Context(), id, ownerID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "notificação não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}

	httputil.OK(w, n)
}

func (h *Handler) processQueue(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.ProcessQueue(r.Context(), 50); err != nil {
		httputil.Err(w, http.StatusInternalServerError, "PROCESS_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]string{"status": "processed"})
}
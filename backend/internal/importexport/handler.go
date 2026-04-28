package importexport

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.Post("/import", h.handleImport)
		r.Get("/import/history", h.handleListHistory)
		r.Get("/import/history/{id}", h.handleGetHistory)
	})
}

func (h *Handler) handleImport(w http.ResponseWriter, r *http.Request) {
	var req ImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Owner not found")
		return
	}

	resp, err := h.service.ImportRecords(r.Context(), ownerID, req)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "IMPORT_FAILED", err.Error())
		return
	}

	httputil.OK(w, resp)
}

func (h *Handler) handleListHistory(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Owner not found")
		return
	}

	histories, err := h.service.ListHistory(r.Context(), ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}

	httputil.OK(w, histories)
}

func (h *Handler) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "Invalid import ID")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "Owner not found")
		return
	}

	history, err := h.service.GetHistory(r.Context(), id, ownerID)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "Import not found")
		return
	}

	httputil.OK(w, history)
}
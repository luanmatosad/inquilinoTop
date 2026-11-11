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
	})
}

// @Summary Importa registros (inquilinos, imóveis, contratos, etc.) em lote
// @Tags importexport
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body ImportRequest true "Registros a importar"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /import [post]
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

	// Mesmo padrão do handler de tenant: o userID gravado é o owner do token.
	userID := ownerID
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return
	}

	resp, err := h.service.ImportRecords(r.Context(), ownerID, userID, orgID, req)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "IMPORT_FAILED", err.Error())
		return
	}

	httputil.OK(w, resp)
}

// @Summary Lista o histórico de importações da organização
// @Tags importexport
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /import/history [get]
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

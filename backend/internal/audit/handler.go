package audit

import (
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc   *Service
	roles rbac.MembershipRoles
}

func NewHandler(svc *Service, roles rbac.MembershipRoles) *Handler {
	return &Handler{svc: svc, roles: roles}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/audit-logs", h.list)
}

// @Summary Lista os logs de auditoria da organização (somente owner)
// @Tags audit
// @Security BearerAuth
// @Produce json
// @Param from query string false "Início do período (RFC3339)"
// @Param to query string false "Fim do período (RFC3339)"
// @Param event_type query string false "Tipo do evento"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 403 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /audit-logs [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
		return
	}
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "NO_ORG", "organização não encontrada")
		return
	}
	role, err := h.roles.RoleIn(r.Context(), ownerID, orgID)
	if err != nil && !errors.Is(err, rbac.ErrNotMember) {
		httputil.Err(w, http.StatusInternalServerError, "ROLE_LOOKUP_FAILED", "erro ao verificar permissão")
		return
	}
	if err != nil || role != rbac.RoleOwner {
		httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "apenas o owner acessa o log de auditoria")
		return
	}

	var from, to *time.Time
	if fromStr := r.URL.Query().Get("from"); fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr)
		if err == nil {
			from = &t
		}
	}
	if toStr := r.URL.Query().Get("to"); toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr)
		if err == nil {
			to = &t
		}
	}

	var eventType *string
	if et := r.URL.Query().Get("event_type"); et != "" {
		eventType = &et
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
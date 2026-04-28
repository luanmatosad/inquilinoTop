package identity

import (
	"encoding/json"
	"net/http"

	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

// @Summary     Buscar preferências de notificação
// @Tags        identity
// @Security    BearerAuth
// @Produce     json
// @Success     200  {object}  map[string]interface{}
// @Failure     500  {object}  map[string]interface{}
// @Router      /auth/notification-preferences [get]
func (h *Handler) getNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	prefs, err := h.svc.GetNotificationPreferences(r.Context(), userID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao buscar preferências")
		return
	}
	if prefs == nil {
		prefs = &NotificationPreferences{
			UserID:                   userID,
			NotifyPaymentOverdue:     true,
			NotifyLeaseExpiring:      true,
			NotifyLeaseExpiringDays:  30,
			NotifyNewMessage:         true,
			NotifyMaintenanceRequest: true,
			NotifyPaymentReceived:    true,
		}
	}
	httputil.OK(w, prefs)
}

// @Summary     Atualizar preferências de notificação
// @Tags        identity
// @Security    BearerAuth
// @Accept      json
// @Produce     json
// @Param       body body UpsertNotificationPreferencesInput true "Preferências"
// @Success     200  {object}  map[string]interface{}
// @Failure     400  {object}  map[string]interface{}
// @Failure     500  {object}  map[string]interface{}
// @Router      /auth/notification-preferences [put]
func (h *Handler) updateNotificationPreferences(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())

	var in UpsertNotificationPreferencesInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_PAYLOAD", "Payload inválido")
		return
	}

	prefs, err := h.svc.UpdateNotificationPreferences(r.Context(), userID, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao atualizar preferências")
		return
	}
	httputil.OK(w, prefs)
}

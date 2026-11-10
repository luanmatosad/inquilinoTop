package identity

import (
	"encoding/json"
	"net/http"

	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	view, err := h.svc.ProfileView(r.Context(), userID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao buscar perfil")
		return
	}

	httputil.OK(w, view)
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	
	var in UpsertProfileInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_PAYLOAD", "Payload inválido")
		return
	}
	
	profile, err := h.svc.UpdateProfile(r.Context(), userID, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Erro ao atualizar perfil")
		return
	}
	
	httputil.OK(w, profile)
}

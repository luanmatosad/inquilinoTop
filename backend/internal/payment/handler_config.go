package payment

import (
	"encoding/json"
	"net/http"

	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

func (h *Handler) getFinancialConfig(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	config, err := h.svc.GetFinancialConfig(r.Context(), ownerID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	httputil.OK(w, config)
}

func (h *Handler) updateFinancialConfig(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	
	var in UpsertFinancialConfigInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", "Payload inválido")
		return
	}

	config, err := h.svc.UpdateFinancialConfig(r.Context(), ownerID, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}

	httputil.OK(w, config)
}

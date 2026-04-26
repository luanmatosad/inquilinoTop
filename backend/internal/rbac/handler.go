package rbac

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
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
	r.With(authMW).Get("/api/v2/me/roles", h.getMyRoles)
	r.With(authMW).Post("/api/v2/roles", h.assignRole)
	r.With(authMW).Delete("/api/v2/roles", h.removeRole)
}

// @Summary Lista roles do usuário autenticado
// @Tags rbac
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /me/roles [get]
func (h *Handler) getMyRoles(w http.ResponseWriter, r *http.Request) {
	userID := auth.OwnerIDFromCtx(r.Context())
	roles, err := h.svc.GetUserRoles(r.Context(), userID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "ROLES_FAILED", err.Error())
		return
	}
	if roles == nil {
		roles = []UserRole{}
	}
	httputil.OK(w, roles)
}

// @Summary Atribui role a um usuário
// @Tags rbac
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body AssignRoleInput true "Dados da role"
// @Success 201 {object} map[string]interface{}
// @Router /roles [post]
func (h *Handler) assignRole(w http.ResponseWriter, r *http.Request) {
	var in AssignRoleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}

	if err := h.svc.AssignRole(r.Context(), in.UserID, in.Role, in.PropertyID); err != nil {
		if errors.Is(err, ErrRoleAlreadyExists) {
			httputil.Err(w, http.StatusConflict, "ROLE_EXISTS", "role já atribuída")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "ASSIGN_FAILED", err.Error())
		return
	}
	httputil.Created(w, map[string]bool{"assigned": true})
}

// @Summary Remove role de um usuário
// @Tags rbac
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body RemoveRoleInput true "Dados da role"
// @Success 200 {object} map[string]interface{}
// @Router /roles [delete]
func (h *Handler) removeRole(w http.ResponseWriter, r *http.Request) {
	var in RemoveRoleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}

	if err := h.svc.RemoveRole(r.Context(), in.UserID, in.Role, in.PropertyID); err != nil {
		if errors.Is(err, ErrRoleNotFound) {
			httputil.Err(w, http.StatusNotFound, "ROLE_NOT_FOUND", "role não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "REMOVE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"removed": true})
}

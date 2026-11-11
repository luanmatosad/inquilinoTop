package rbac

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/inquilinotop/api/pkg/validator"
)

type Handler struct {
	svc   *Service
	roles MembershipRoles
}

func NewHandler(svc *Service, roles MembershipRoles) *Handler {
	return &Handler{svc: svc, roles: roles}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/api/v2/me/roles", h.getMyRoles)
	r.With(authMW, PermissionMiddleware(h.roles, PermissionMemberManage)).Post("/api/v2/roles", h.assignRole)
	r.With(authMW, PermissionMiddleware(h.roles, PermissionMemberManage)).Delete("/api/v2/roles", h.removeRole)
}

// canChangeRole: caller só altera roles da própria org; só owner altera role owner.
// O papel do caller é lido do banco (organization_members), nunca do JWT.
func (h *Handler) canChangeRole(r *http.Request, orgID *uuid.UUID, role RoleType) (bool, error) {
	ctx := r.Context()
	callerOrg := auth.OrganizationIDFromCtx(ctx)
	if orgID == nil || *orgID != callerOrg {
		return false, nil
	}
	if role != RoleOwner {
		return true, nil
	}
	callerRole, err := h.roles.RoleIn(ctx, auth.OwnerIDFromCtx(ctx), callerOrg)
	if errors.Is(err, ErrNotMember) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return callerRole == RoleOwner, nil
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
	allowed, err := h.canChangeRole(r, in.OrganizationID, in.Role)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "ROLE_LOOKUP_FAILED", "erro ao verificar permissão")
		return
	}
	if !allowed {
		httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "sem permissão para esta ação")
		return
	}

	if err := h.svc.AssignRole(r.Context(), in.UserID, in.Role, in.OrganizationID, in.BranchID); err != nil {
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
	allowed, err := h.canChangeRole(r, in.OrganizationID, in.Role)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "ROLE_LOOKUP_FAILED", "erro ao verificar permissão")
		return
	}
	if !allowed {
		httputil.Err(w, http.StatusForbidden, "FORBIDDEN", "sem permissão para esta ação")
		return
	}

	if err := h.svc.RemoveRole(r.Context(), in.UserID, in.Role, in.OrganizationID, in.BranchID); err != nil {
		if errors.Is(err, ErrRoleNotFound) {
			httputil.Err(w, http.StatusNotFound, "ROLE_NOT_FOUND", "role não encontrada")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "REMOVE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"removed": true})
}

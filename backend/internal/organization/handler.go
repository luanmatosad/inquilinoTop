package organization

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc      *Service
	validate *validator.Validate
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc, validate: validator.New()}
}

// Guards são os middlewares rbac.PermissionMiddleware de cada grupo de rotas. Montados no main.go.
type Guards struct {
	OrgRead, OrgUpdate, BranchManage, MemberManage, MemberInvite func(http.Handler) http.Handler
}

func (h *Handler) RegisterRoutes(r chi.Router, authMw func(http.Handler) http.Handler, g Guards) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)
		r.With(g.OrgRead).Get("/organizations/me", h.GetMyOrganization)
		r.With(g.OrgRead).Get("/organizations/me/membership", h.GetMyMembership)
		r.Post("/organizations", h.CreateOrganization)
		r.With(g.OrgUpdate).Patch("/organizations/me", h.UpdateOrganization)

		r.Get("/organizations/me/branches", h.ListBranches)
		r.With(g.BranchManage).Post("/organizations/me/branches", h.CreateBranch)
		r.Get("/organizations/me/branches/{id}", h.GetBranch)
		r.With(g.BranchManage).Patch("/organizations/me/branches/{id}", h.UpdateBranch)
		r.With(g.BranchManage).Delete("/organizations/me/branches/{id}", h.DeleteBranch)

		r.With(g.OrgRead).Get("/organizations/me/members", h.ListMembers)
		r.With(g.MemberManage).Patch("/organizations/me/members/{id}/role", h.UpdateMemberRole)
		r.With(g.MemberManage).Delete("/organizations/me/members/{id}", h.RemoveMember)

		r.With(g.MemberInvite).Get("/organizations/me/invites", h.ListInvites)
		r.With(g.MemberInvite).Post("/organizations/me/invites", h.CreateInvite)
		r.With(g.MemberInvite).Delete("/organizations/me/invites/{id}", h.CancelInvite)

		r.Post("/invites/accept", h.AcceptInvite)
	})
}

// @Summary Retorna a organização do usuário autenticado
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me [get]
func (h *Handler) GetMyOrganization(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	ownerID := auth.OwnerIDFromCtx(ctx)
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "usuário não autenticado")
		return
	}
	org, err := h.svc.GetMyOrganization(ctx)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "GET_ORG_FAILED", err.Error())
		return
	}
	if org == nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "organização não encontrada")
		return
	}
	httputil.OK(w, org)
}

// myMembership é a resposta de GET /organizations/me/membership: a org do usuário, seu papel e filial,
// e as permissões que o RBAC concede a esse papel.
type myMembership struct {
	Organization *Organization     `json:"organization"`
	Role         RoleType          `json:"role"`
	BranchID     *uuid.UUID        `json:"branch_id,omitempty"`
	Permissions  []rbac.Permission `json:"permissions"`
}

// @Summary Org, papel, filial e permissões do usuário autenticado
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/membership [get]
func (h *Handler) GetMyMembership(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := auth.OwnerIDFromCtx(ctx)
	if userID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "usuário não autenticado")
		return
	}
	m, err := h.svc.GetMembership(ctx, userID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "GET_MEMBERSHIP_FAILED", err.Error())
		return
	}
	if m == nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "membership não encontrada")
		return
	}
	org, err := h.svc.GetOrganization(ctx)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "GET_ORG_FAILED", err.Error())
		return
	}
	if org == nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "organização não encontrada")
		return
	}
	httputil.OK(w, myMembership{
		Organization: org,
		Role:         m.Role,
		BranchID:     m.BranchID,
		Permissions:  rbac.GetPermissionsForRole(rbac.RoleType(m.Role)),
	})
}

// @Summary Atualiza os dados da organização
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body UpdateOrgInput true "Campos da organização"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me [patch]
func (h *Handler) UpdateOrganization(w http.ResponseWriter, r *http.Request) {
	var in UpdateOrgInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	org, err := h.svc.UpdateOrganization(r.Context(), in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "UPDATE_ORG_FAILED", err.Error())
		return
	}
	httputil.OK(w, org)
}

// @Summary Cria a organização do usuário autenticado
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateOrgInput true "Dados da organização"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations [post]
func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	var in CreateOrgInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	org, err := h.svc.CreateOrganization(r.Context(), in)
	if errors.Is(err, ErrAlreadyHasOrganization) {
		httputil.Err(w, http.StatusConflict, "ALREADY_HAS_ORG", err.Error())
		return
	}
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "CREATE_ORG_FAILED", err.Error())
		return
	}
	httputil.Created(w, org)
}

// @Summary Lista as filiais da organização
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/branches [get]
func (h *Handler) ListBranches(w http.ResponseWriter, r *http.Request) {
	branches, err := h.svc.ListBranches(r.Context())
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_BRANCHES_FAILED", err.Error())
		return
	}
	if branches == nil {
		branches = []Branch{}
	}
	httputil.OK(w, branches)
}

// @Summary Cria uma filial
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateBranchInput true "Dados da filial"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/branches [post]
func (h *Handler) CreateBranch(w http.ResponseWriter, r *http.Request) {
	var in CreateBranchInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	branch, err := h.svc.CreateBranch(r.Context(), in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "CREATE_BRANCH_FAILED", err.Error())
		return
	}
	httputil.Created(w, branch)
}

// @Summary Retorna uma filial da organização
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da filial"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /organizations/me/branches/{id} [get]
func (h *Handler) GetBranch(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "invalid branch id")
		return
	}
	branch, err := h.svc.GetBranch(r.Context(), id)
	if err != nil {
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "branch not found")
		return
	}
	httputil.OK(w, branch)
}

// @Summary Atualiza uma filial
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID da filial"
// @Param body body UpdateBranchInput true "Campos da filial"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/branches/{id} [patch]
func (h *Handler) UpdateBranch(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "invalid branch id")
		return
	}
	var in UpdateBranchInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	branch, err := h.svc.UpdateBranch(r.Context(), id, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "UPDATE_BRANCH_FAILED", err.Error())
		return
	}
	httputil.OK(w, branch)
}

// @Summary Remove uma filial
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID da filial"
// @Success 204
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/branches/{id} [delete]
func (h *Handler) DeleteBranch(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "invalid branch id")
		return
	}
	if err := h.svc.DeleteBranch(r.Context(), id); err != nil {
		httputil.Err(w, http.StatusInternalServerError, "DELETE_BRANCH_FAILED", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// @Summary Lista os membros da organização
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/members [get]
func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	members, err := h.svc.ListMembers(r.Context())
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_MEMBERS_FAILED", err.Error())
		return
	}
	if members == nil {
		members = []Member{}
	}
	httputil.OK(w, members)
}

// @Summary Altera o papel de um membro
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do membro"
// @Param body body UpdateMemberRoleInput true "Novo papel"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/members/{id}/role [patch]
func (h *Handler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "invalid member id")
		return
	}
	var in UpdateMemberRoleInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	member, err := h.svc.UpdateMemberRole(r.Context(), id, in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "UPDATE_ROLE_FAILED", err.Error())
		return
	}
	httputil.OK(w, member)
}

// @Summary Remove um membro da organização
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do membro"
// @Success 204
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/members/{id} [delete]
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "invalid member id")
		return
	}
	if err := h.svc.RemoveMember(r.Context(), id); err != nil {
		httputil.Err(w, http.StatusInternalServerError, "REMOVE_MEMBER_FAILED", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// @Summary Lista os convites da organização
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/invites [get]
func (h *Handler) ListInvites(w http.ResponseWriter, r *http.Request) {
	invites, err := h.svc.ListInvites(r.Context())
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_INVITES_FAILED", err.Error())
		return
	}
	if invites == nil {
		invites = []Invite{}
	}
	httputil.OK(w, invites)
}

// @Summary Cria um convite para um novo membro
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateInviteInput true "Dados do convite"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/invites [post]
func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	var in CreateInviteInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if in.Role == RoleOwner {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ROLE", "owner não pode ser convidado")
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	invite, err := h.svc.CreateInvite(r.Context(), in)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "CREATE_INVITE_FAILED", err.Error())
		return
	}
	httputil.Created(w, invite)
}

// @Summary Cancela um convite pendente
// @Tags organization
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do convite"
// @Success 204
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /organizations/me/invites/{id} [delete]
func (h *Handler) CancelInvite(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "invalid invite id")
		return
	}
	if err := h.svc.CancelInvite(r.Context(), id); err != nil {
		httputil.Err(w, http.StatusInternalServerError, "CANCEL_INVITE_FAILED", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// @Summary Aceita um convite com o token recebido por e-mail
// @Tags organization
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body map[string]string true "token: token do convite"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /invites/accept [post]
func (h *Handler) AcceptInvite(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token string `json:"token" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
		return
	}
	if err := h.validate.Struct(in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "VALIDATION_FAILED", err.Error())
		return
	}
	ownerID := auth.OwnerIDFromCtx(r.Context())
	if err := h.svc.AcceptInvite(r.Context(), in.Token, ownerID); err != nil {
		writeAcceptInviteErr(w, err)
		return
	}
	httputil.OK(w, map[string]string{"message": "convite aceito com sucesso"})
}

func writeAcceptInviteErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInviteNotFound):
		httputil.Err(w, http.StatusNotFound, "INVITE_NOT_FOUND", "convite não encontrado")
	case errors.Is(err, ErrInviteExpired):
		httputil.Err(w, http.StatusBadRequest, "INVITE_EXPIRED", "convite expirado")
	case errors.Is(err, ErrInviteAlreadyUsed):
		httputil.Err(w, http.StatusConflict, "INVITE_ALREADY_USED", "convite já utilizado")
	case errors.Is(err, ErrInviteBranchGone):
		httputil.Err(w, http.StatusConflict, "INVITE_BRANCH_GONE", "filial do convite não existe mais")
	case errors.Is(err, ErrAlreadyHasOrganization):
		httputil.Err(w, http.StatusConflict, "ALREADY_HAS_ORG", "usuário já possui organização")
	default:
		httputil.Err(w, http.StatusInternalServerError, "ACCEPT_INVITE_FAILED", "erro ao aceitar convite")
	}
}
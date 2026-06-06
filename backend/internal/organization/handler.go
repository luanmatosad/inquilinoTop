package organization

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
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

func (h *Handler) RegisterRoutes(r chi.Router, authMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMw)
		r.Get("/organizations/me", h.GetMyOrganization)
		r.Patch("/organizations/me", h.UpdateOrganization)

		r.Get("/organizations/me/branches", h.ListBranches)
		r.Post("/organizations/me/branches", h.CreateBranch)
		r.Get("/organizations/me/branches/{id}", h.GetBranch)
		r.Patch("/organizations/me/branches/{id}", h.UpdateBranch)
		r.Delete("/organizations/me/branches/{id}", h.DeleteBranch)

		r.Get("/organizations/me/members", h.ListMembers)
		r.Patch("/organizations/me/members/{id}/role", h.UpdateMemberRole)
		r.Delete("/organizations/me/members/{id}", h.RemoveMember)

		r.Get("/organizations/me/invites", h.ListInvites)
		r.Post("/organizations/me/invites", h.CreateInvite)
		r.Delete("/organizations/me/invites/{id}", h.CancelInvite)

		r.Post("/invites/accept", h.AcceptInvite)
	})
}

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

func (h *Handler) CreateInvite(w http.ResponseWriter, r *http.Request) {
	var in CreateInviteInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
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
		httputil.Err(w, http.StatusBadRequest, "ACCEPT_INVITE_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]string{"message": "convite aceito com sucesso"})
}
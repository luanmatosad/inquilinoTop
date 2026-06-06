package organization

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Organization struct {
	ID        uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Plan      string    `json:"plan"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Branch struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Name           string    `json:"name"`
	Region         *string   `json:"region,omitempty"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Member struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	UserID         uuid.UUID `json:"user_id"`
	Role           RoleType  `json:"role"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	UserEmail      string    `json:"user_email,omitempty"`
	UserFullName   *string   `json:"user_full_name,omitempty"`
	BranchName     *string   `json:"branch_name,omitempty"`
}

type Invite struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Email          string    `json:"email"`
	Role           RoleType  `json:"role"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
	Token          string    `json:"-"`
	InvitedBy      uuid.UUID `json:"invited_by"`
	ExpiresAt      time.Time `json:"expires_at"`
	AcceptedAt     *time.Time `json:"accepted_at,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type RoleType string

const (
	RoleOwner    RoleType = "owner"
	RoleAdmin   RoleType = "admin"
	RoleManager RoleType = "manager"
	RoleEmployee RoleType = "employee"
	RoleViewer  RoleType = "viewer"
)

type UpdateOrgInput struct {
	Name string `json:"name" validate:"required,max=255"`
}

type CreateBranchInput struct {
	Name   string  `json:"name" validate:"required,max=255"`
	Region *string `json:"region,omitempty" validate:"omitempty,max=100"`
}

type UpdateBranchInput struct {
	Name   string  `json:"name" validate:"required,max=255"`
	Region *string `json:"region,omitempty" validate:"omitempty,max=100"`
	IsActive *bool  `json:"is_active,omitempty"`
}

type UpdateMemberRoleInput struct {
	Role RoleType `json:"role" validate:"required,oneof=owner admin manager employee viewer"`
}

type CreateInviteInput struct {
	Email    string     `json:"email" validate:"required,email"`
	Role     RoleType   `json:"role" validate:"required,oneof=owner admin manager employee viewer"`
	BranchID *uuid.UUID `json:"branch_id,omitempty"`
}

type OrganizationWithDetails struct {
	Organization
	Branches []Branch  `json:"branches,omitempty"`
	Members  []Member  `json:"members,omitempty"`
	Owner    *Member   `json:"owner,omitempty"`
}

type Repository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*Organization, error)
	GetByUserID(ctx context.Context, userID uuid.UUID) (*Organization, error)
	Update(ctx context.Context, id uuid.UUID, in UpdateOrgInput) (*Organization, error)
	Create(ctx context.Context, name string) (*Organization, error)

	CreateBranch(ctx context.Context, orgID uuid.UUID, in CreateBranchInput) (*Branch, error)
	GetBranch(ctx context.Context, id, orgID uuid.UUID) (*Branch, error)
	ListBranches(ctx context.Context, orgID uuid.UUID) ([]Branch, error)
	UpdateBranch(ctx context.Context, id, orgID uuid.UUID, in UpdateBranchInput) (*Branch, error)
	DeleteBranch(ctx context.Context, id, orgID uuid.UUID) error

	GetMembership(ctx context.Context, userID, orgID uuid.UUID) (*Member, error)
	GetMembershipByID(ctx context.Context, memberID uuid.UUID) (*Member, error)
	ListMembers(ctx context.Context, orgID uuid.UUID) ([]Member, error)
	UpdateMemberRole(ctx context.Context, memberID uuid.UUID, role RoleType) error
	RemoveMember(ctx context.Context, memberID, orgID uuid.UUID) error
	CreateMember(ctx context.Context, orgID, userID uuid.UUID, role RoleType, branchID *uuid.UUID) (*Member, error)
	HasRole(ctx context.Context, userID, orgID uuid.UUID, role RoleType) (bool, error)

	CreateInvite(ctx context.Context, in CreateInviteInput, orgID, invitedBy uuid.UUID, token string, expiresAt time.Time) (*Invite, error)
	GetInviteByToken(ctx context.Context, token string) (*Invite, error)
	ListInvites(ctx context.Context, orgID uuid.UUID) ([]Invite, error)
	CancelInvite(ctx context.Context, inviteID, orgID uuid.UUID) error
	AcceptInvite(ctx context.Context, inviteID uuid.UUID) error
	GetInviteByEmail(ctx context.Context, email string, orgID uuid.UUID) (*Invite, error)

	GetMembershipByUserID(ctx context.Context, userID uuid.UUID) (*Member, error)
}
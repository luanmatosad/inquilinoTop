package rbac

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type RoleType string

const (
	RoleOwner    RoleType = "owner"
	RoleAdmin    RoleType = "admin"
	RoleManager  RoleType = "manager"
	RoleEmployee RoleType = "employee"
	RoleViewer   RoleType = "viewer"
)

type Permission string

const (
	PermissionPropertyRead   Permission = "property:read"
	PermissionPropertyWrite  Permission = "property:write"
	PermissionTenantRead     Permission = "tenant:read"
	PermissionTenantWrite    Permission = "tenant:write"
	PermissionLeaseRead      Permission = "lease:read"
	PermissionLeaseWrite     Permission = "lease:write"
	PermissionPaymentRead    Permission = "payment:read"
	PermissionPaymentWrite   Permission = "payment:write"
	PermissionExpenseRead    Permission = "expense:read"
	PermissionExpenseWrite   Permission = "expense:write"
	PermissionMemberInvite   Permission = "member:invite"
	PermissionMemberManage   Permission = "member:manage"
	PermissionBranchManage   Permission = "branch:manage"
	PermissionOrgRead        Permission = "org:read"
	PermissionOrgUpdate      Permission = "org:update"
)

type UserRole struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	Role           RoleType   `json:"role"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type CreateInput struct {
	UserID         uuid.UUID
	Role           RoleType
	OrganizationID *uuid.UUID
	BranchID       *uuid.UUID
}

type AssignRoleInput struct {
	UserID         uuid.UUID  `json:"user_id" validate:"required"`
	Role           RoleType   `json:"role" validate:"required,oneof=owner admin manager employee viewer"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
}

type RemoveRoleInput struct {
	UserID         uuid.UUID  `json:"user_id" validate:"required"`
	Role           RoleType   `json:"role" validate:"required,oneof=owner admin manager employee viewer"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
}

type CheckPermissionInput struct {
	OrganizationID uuid.UUID
	BranchID       *uuid.UUID
	Permission     Permission
}

type Repository interface {
	Create(ctx context.Context, in CreateInput) (*UserRole, error)
	Delete(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) error
	GetByUser(ctx context.Context, userID uuid.UUID) ([]UserRole, error)
	GetByUserAndOrg(ctx context.Context, userID, orgID uuid.UUID) ([]UserRole, error)
	HasRole(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) (bool, error)
	HasAnyRole(ctx context.Context, userID, orgID uuid.UUID) (bool, error)
}
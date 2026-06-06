package rbac

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrRoleAlreadyExists = errors.New("role already exists")
	ErrRoleNotFound      = errors.New("role not found")
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) AssignRole(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) error {
	hasAny, err := s.repo.HasAnyRole(ctx, userID, *orgID)
	if err != nil {
		return err
	}
	if hasAny {
		return ErrRoleAlreadyExists
	}
	_, err = s.repo.Create(ctx, CreateInput{
		UserID:         userID,
		Role:           role,
		OrganizationID: orgID,
		BranchID:       branchID,
	})
	return err
}

func (s *Service) RemoveRole(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) error {
	exists, err := s.repo.HasRole(ctx, userID, role, orgID, branchID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrRoleNotFound
	}
	return s.repo.Delete(ctx, userID, role, orgID, branchID)
}

func (s *Service) CheckPermission(ctx context.Context, userID uuid.UUID, role RoleType, orgID, branchID *uuid.UUID) (bool, error) {
	return s.repo.HasRole(ctx, userID, role, orgID, branchID)
}

func (s *Service) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]UserRole, error) {
	return s.repo.GetByUser(ctx, userID)
}

func (s *Service) GetUserRolesForOrg(ctx context.Context, userID, orgID uuid.UUID) ([]UserRole, error) {
	return s.repo.GetByUserAndOrg(ctx, userID, orgID)
}

func (s *Service) AssignOrgRole(ctx context.Context, userID, orgID uuid.UUID, role RoleType, branchID *uuid.UUID) error {
	hasAny, err := s.repo.HasAnyRole(ctx, userID, orgID)
	if err != nil {
		return err
	}
	if hasAny {
		return ErrRoleAlreadyExists
	}
	_, err = s.repo.Create(ctx, CreateInput{
		UserID:         userID,
		Role:           role,
		OrganizationID: &orgID,
		BranchID:       branchID,
	})
	return err
}

func (s *Service) RemoveOrgRole(ctx context.Context, userID, orgID uuid.UUID) error {
	return s.repo.Delete(ctx, userID, RoleViewer, &orgID, nil)
}

func (s *Service) HasPermission(ctx context.Context, userID, orgID uuid.UUID, role RoleType, permission Permission) bool {
	hasRole, err := s.repo.HasRole(ctx, userID, role, &orgID, nil)
	if err != nil || !hasRole {
		return false
	}
	return HasPermission(role, permission)
}

func (s *Service) GetUserPermissions(ctx context.Context, userID, orgID uuid.UUID) ([]Permission, error) {
	roles, err := s.repo.GetByUserAndOrg(ctx, userID, orgID)
	if err != nil {
		return nil, err
	}
	if len(roles) == 0 {
		return nil, nil
	}

	highestRole := RoleViewer
	highestLevel := 0
	for _, r := range roles {
		if level, ok := roleHierarchy[r.Role]; ok && level > highestLevel {
			highestLevel = level
			highestRole = r.Role
		}
	}
	return GetPermissionsForRole(highestRole), nil
}

var roleHierarchy = map[RoleType]int{
	RoleOwner:    5,
	RoleAdmin:    4,
	RoleManager:  3,
	RoleEmployee: 2,
	RoleViewer:   1,
}

type permissionMatrix map[RoleType][]Permission

var permissions = permissionMatrix{
	RoleOwner: {
		PermissionPropertyRead, PermissionPropertyWrite,
		PermissionTenantRead, PermissionTenantWrite,
		PermissionLeaseRead, PermissionLeaseWrite,
		PermissionPaymentRead, PermissionPaymentWrite,
		PermissionExpenseRead, PermissionExpenseWrite,
		PermissionMemberInvite, PermissionMemberManage,
		PermissionBranchManage,
		PermissionOrgRead, PermissionOrgUpdate,
	},
	RoleAdmin: {
		PermissionPropertyRead, PermissionPropertyWrite,
		PermissionTenantRead, PermissionTenantWrite,
		PermissionLeaseRead, PermissionLeaseWrite,
		PermissionPaymentRead, PermissionPaymentWrite,
		PermissionExpenseRead, PermissionExpenseWrite,
		PermissionMemberInvite, PermissionMemberManage,
		PermissionBranchManage,
		PermissionOrgRead,
	},
	RoleManager: {
		PermissionPropertyRead, PermissionPropertyWrite,
		PermissionTenantRead, PermissionTenantWrite,
		PermissionLeaseRead, PermissionLeaseWrite,
		PermissionPaymentRead, PermissionPaymentWrite,
		PermissionExpenseRead,
		PermissionBranchManage,
		PermissionOrgRead,
	},
	RoleEmployee: {
		PermissionPropertyRead,
		PermissionTenantRead,
		PermissionLeaseRead,
		PermissionPaymentRead,
		PermissionExpenseRead,
		PermissionOrgRead,
	},
	RoleViewer: {
		PermissionPropertyRead,
		PermissionOrgRead,
	},
}

func HasPermission(role RoleType, permission Permission) bool {
	perms, ok := permissions[role]
	if !ok {
		return false
	}
	for _, p := range perms {
		if p == permission {
			return true
		}
	}
	return false
}

func GetPermissionsForRole(role RoleType) []Permission {
	perms, ok := permissions[role]
	if !ok {
		return nil
	}
	result := make([]Permission, len(perms))
	copy(result, perms)
	return result
}
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

func (s *Service) AssignRole(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) error {
	exists, err := s.repo.HasRole(ctx, userID, role, propertyID)
	if err != nil {
		return err
	}
	if exists {
		return ErrRoleAlreadyExists
	}
	_, err = s.repo.Create(ctx, CreateInput{
		UserID:     userID,
		Role:       role,
		PropertyID: propertyID,
	})
	return err
}

func (s *Service) RemoveRole(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) error {
	exists, err := s.repo.HasRole(ctx, userID, role, propertyID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrRoleNotFound
	}
	return s.repo.Delete(ctx, userID, role, propertyID)
}

func (s *Service) CheckPermission(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) (bool, error) {
	return s.repo.HasRole(ctx, userID, role, propertyID)
}

func (s *Service) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]UserRole, error) {
	return s.repo.GetByUser(ctx, userID)
}

func (s *Service) GetUserRolesForProperty(ctx context.Context, userID, propertyID uuid.UUID) ([]UserRole, error) {
	return s.repo.GetByUserAndProperty(ctx, userID, propertyID)
}
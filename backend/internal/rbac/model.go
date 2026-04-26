package rbac

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type RoleType string

const (
	RoleOwner  RoleType = "owner"
	RoleAdmin  RoleType = "admin"
	RoleViewer RoleType = "viewer"
)

type UserRole struct {
	ID          uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	Role       RoleType `json:"role"`
	PropertyID *uuid.UUID `json:"property_id,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type CreateInput struct {
	UserID     uuid.UUID
	Role       RoleType
	PropertyID *uuid.UUID
}

type AssignRoleInput struct {
	UserID     uuid.UUID  `json:"user_id" validate:"required"`
	Role       RoleType   `json:"role" validate:"required,oneof=owner admin viewer"`
	PropertyID *uuid.UUID `json:"property_id,omitempty"`
}

type RemoveRoleInput struct {
	UserID     uuid.UUID  `json:"user_id" validate:"required"`
	Role       RoleType   `json:"role" validate:"required,oneof=owner admin viewer"`
	PropertyID *uuid.UUID `json:"property_id,omitempty"`
}

type Repository interface {
	Create(ctx context.Context, in CreateInput) (*UserRole, error)
	Delete(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) error
	GetByUser(ctx context.Context, userID uuid.UUID) ([]UserRole, error)
	GetByUserAndProperty(ctx context.Context, userID, propertyID uuid.UUID) ([]UserRole, error)
	HasRole(ctx context.Context, userID uuid.UUID, role RoleType, propertyID *uuid.UUID) (bool, error)
}
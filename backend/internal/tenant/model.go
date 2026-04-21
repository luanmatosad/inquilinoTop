package tenant

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID         uuid.UUID `json:"id"`
	OwnerID    uuid.UUID `json:"owner_id"`
	Name       string    `json:"name"`
	Email      *string   `json:"email,omitempty"`
	Phone      *string   `json:"phone,omitempty"`
	Document   *string   `json:"document,omitempty"`
	PersonType string    `json:"person_type"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateTenantInput struct {
	Name       string  `json:"name"`
	Email      *string `json:"email,omitempty"`
	Phone      *string `json:"phone,omitempty"`
	Document   *string `json:"document,omitempty"`
	PersonType *string `json:"person_type,omitempty"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Tenant, error)
	List(ctx context.Context, ownerID uuid.UUID) ([]Tenant, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
}

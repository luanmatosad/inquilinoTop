package tenant

import (
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID        uuid.UUID `json:"id"`
	OwnerID   uuid.UUID `json:"owner_id"`
	Name      string    `json:"name"`
	Email     *string   `json:"email,omitempty"`
	Phone     *string   `json:"phone,omitempty"`
	Document  *string   `json:"document,omitempty"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateTenantInput struct {
	Name     string  `json:"name"`
	Email    *string `json:"email,omitempty"`
	Phone    *string `json:"phone,omitempty"`
	Document *string `json:"document,omitempty"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	GetByID(id, ownerID uuid.UUID) (*Tenant, error)
	List(ownerID uuid.UUID) ([]Tenant, error)
	Update(id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	Delete(id, ownerID uuid.UUID) error
}

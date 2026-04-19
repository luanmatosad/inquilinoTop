package property

import (
	"time"

	"github.com/google/uuid"
)

type Property struct {
	ID          uuid.UUID `json:"id"`
	OwnerID     uuid.UUID `json:"owner_id"`
	Type        string    `json:"type"`
	Name        string    `json:"name"`
	AddressLine *string   `json:"address_line,omitempty"`
	City        *string   `json:"city,omitempty"`
	State       *string   `json:"state,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Unit struct {
	ID         uuid.UUID `json:"id"`
	PropertyID uuid.UUID `json:"property_id"`
	Label      string    `json:"label"`
	Floor      *string   `json:"floor,omitempty"`
	Notes      *string   `json:"notes,omitempty"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreatePropertyInput struct {
	Type        string  `json:"type"`
	Name        string  `json:"name"`
	AddressLine *string `json:"address_line,omitempty"`
	City        *string `json:"city,omitempty"`
	State       *string `json:"state,omitempty"`
}

type CreateUnitInput struct {
	Label string  `json:"label"`
	Floor *string `json:"floor,omitempty"`
	Notes *string `json:"notes,omitempty"`
}

type Repository interface {
	Create(ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	GetByID(id, ownerID uuid.UUID) (*Property, error)
	List(ownerID uuid.UUID) ([]Property, error)
	Update(id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	Delete(id, ownerID uuid.UUID) error
	CreateUnit(propertyID uuid.UUID, in CreateUnitInput) (*Unit, error)
	GetUnit(id uuid.UUID) (*Unit, error)
	ListUnits(propertyID uuid.UUID) ([]Unit, error)
	UpdateUnit(id uuid.UUID, in CreateUnitInput) (*Unit, error)
	DeleteUnit(id uuid.UUID) error
}

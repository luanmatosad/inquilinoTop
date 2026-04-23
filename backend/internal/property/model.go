package property

import (
	"context"
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
	Type        string  `json:"type" validate:"required,oneof=RESIDENTIAL SINGLE"`
	Name        string  `json:"name" validate:"required,max=200"`
	AddressLine *string `json:"address_line,omitempty" validate:"omitempty,max=500"`
	City        *string `json:"city,omitempty" validate:"omitempty,max=100"`
	State       *string `json:"state,omitempty" validate:"omitempty,max=2"`
}

type CreateUnitInput struct {
	Label string  `json:"label" validate:"required,max=100"`
	Floor *string `json:"floor,omitempty" validate:"omitempty,max=50"`
	Notes *string `json:"notes,omitempty" validate:"omitempty,max=2000"`
}

type PropertyWithUnits struct {
	Property
	Units []Unit `json:"units"`
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Property, error)
	List(ctx context.Context, ownerID uuid.UUID) ([]Property, error)
	Update(ctx context.Context, id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
	CreateUnit(ctx context.Context, propertyID uuid.UUID, in CreateUnitInput) (*Unit, error)
	GetUnit(ctx context.Context, id uuid.UUID) (*Unit, error)
	ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error)
	ListUnitsByPropertyIDs(ctx context.Context, propertyIDs []uuid.UUID) ([]Unit, error)
	UpdateUnit(ctx context.Context, id uuid.UUID, in CreateUnitInput) (*Unit, error)
	DeleteUnit(ctx context.Context, id uuid.UUID) error
}

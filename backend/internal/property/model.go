package property

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

// ErrDuplicateUnitLabel indica rótulo de unidade repetido no mesmo imóvel (HTTP 409).
var ErrDuplicateUnitLabel = fmt.Errorf("property: rótulo de unidade já existe no imóvel: %w", apierr.ErrConflict)

type Property struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Type           string    `json:"type"`
	Name           string    `json:"name"`
	AddressLine    *string   `json:"address_line,omitempty"`
	City           *string   `json:"city,omitempty"`
	State          *string   `json:"state,omitempty"`
	PostalCode     *string   `json:"postal_code,omitempty"`
	Neighborhood   *string   `json:"neighborhood,omitempty"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Unit struct {
	ID         uuid.UUID `json:"id"`
	PropertyID uuid.UUID `json:"property_id"`
	Label      string    `json:"label"`
	Floor      *string   `json:"floor,omitempty"`
	Notes      *string   `json:"notes,omitempty"`
	AreaM2     *float64  `json:"area_m2,omitempty"`
	Bedrooms   *int      `json:"bedrooms,omitempty"`
	Bathrooms  *int      `json:"bathrooms,omitempty"`
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
	// PostalCode é o CEP com 8 dígitos, sem máscara.
	PostalCode   *string `json:"postal_code,omitempty" validate:"omitempty,len=8,numeric"`
	Neighborhood *string `json:"neighborhood,omitempty" validate:"omitempty,max=100"`
}

type CreateUnitInput struct {
	Label     string   `json:"label" validate:"required,max=100"`
	Floor     *string  `json:"floor,omitempty" validate:"omitempty,max=50"`
	Notes     *string  `json:"notes,omitempty" validate:"omitempty,max=2000"`
	AreaM2    *float64 `json:"area_m2,omitempty" validate:"omitempty,gt=0"`
	Bedrooms  *int     `json:"bedrooms,omitempty" validate:"omitempty,gte=0"`
	Bathrooms *int     `json:"bathrooms,omitempty" validate:"omitempty,gte=0"`
}

type PropertyWithUnits struct {
	Property
	Units []Unit `json:"units"`
}

type Repository interface {
	Create(ctx context.Context, userID, orgID uuid.UUID, in CreatePropertyInput) (*Property, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Property, error)
	List(ctx context.Context, orgID uuid.UUID) ([]Property, error)
	Update(ctx context.Context, id, orgID uuid.UUID, in CreatePropertyInput) (*Property, error)
	Delete(ctx context.Context, id, orgID uuid.UUID) error
	CreateUnit(ctx context.Context, propertyID uuid.UUID, in CreateUnitInput) (*Unit, error)
	GetUnit(ctx context.Context, id, orgID uuid.UUID) (*Unit, error)
	ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error)
	ListUnitsByPropertyIDs(ctx context.Context, propertyIDs []uuid.UUID) ([]Unit, error)
	UpdateUnit(ctx context.Context, id, orgID uuid.UUID, in CreateUnitInput) (*Unit, error)
	DeleteUnit(ctx context.Context, id, orgID uuid.UUID) error
	GetByField(ctx context.Context, orgID uuid.UUID, field string, value string) (*Property, error)
}

package tenant

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

var (
	// ErrInvalidDocument indica CPF/CNPJ inválido para o person_type (HTTP 400).
	ErrInvalidDocument = errors.New("tenant: documento inválido")
	// ErrDuplicateDocument indica documento já usado por outro inquilino ativo da organização (HTTP 409).
	ErrDuplicateDocument = fmt.Errorf("tenant: documento já cadastrado: %w", apierr.ErrConflict)
	// ErrHasActiveLease indica inquilino com contrato ativo, que não pode ser excluído (HTTP 409).
	ErrHasActiveLease = fmt.Errorf("tenant: inquilino possui contrato ativo: %w", apierr.ErrConflict)
)

type Tenant struct {
	ID             uuid.UUID `json:"id"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Name           string    `json:"name"`
	Email          *string   `json:"email,omitempty"`
	Phone          *string   `json:"phone,omitempty"`
	Document       *string   `json:"document,omitempty"`
	PersonType     string    `json:"person_type"`
	PostalCode     *string   `json:"postal_code,omitempty"`
	AddressLine    *string   `json:"address_line,omitempty"`
	City           *string   `json:"city,omitempty"`
	State          *string   `json:"state,omitempty"`
	Notes          *string   `json:"notes,omitempty"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CreateTenantInput struct {
	Name  string  `json:"name" validate:"required,max=200"`
	Email *string `json:"email,omitempty" validate:"omitempty,email,max=255"`
	Phone *string `json:"phone,omitempty" validate:"omitempty,max=20"`
	// Document aceita CPF/CNPJ com ou sem máscara; o service grava só dígitos.
	Document   *string `json:"document,omitempty" validate:"omitempty,max=20"`
	PersonType *string `json:"person_type" validate:"required,oneof=PF PJ"`
	// PostalCode é o CEP com 8 dígitos, sem máscara.
	PostalCode  *string `json:"postal_code,omitempty" validate:"omitempty,len=8,numeric"`
	AddressLine *string `json:"address_line,omitempty" validate:"omitempty,max=500"`
	City        *string `json:"city,omitempty" validate:"omitempty,max=100"`
	State       *string `json:"state,omitempty" validate:"omitempty,len=2"`
	Notes       *string `json:"notes,omitempty" validate:"omitempty,max=2000"`
}

type Repository interface {
	Create(ctx context.Context, userID, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Tenant, error)
	List(ctx context.Context, orgID uuid.UUID) ([]Tenant, error)
	Update(ctx context.Context, id, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error)
	Delete(ctx context.Context, id, orgID uuid.UUID) error
	GetByField(ctx context.Context, orgID uuid.UUID, field string, value string) (*Tenant, error)
}

// LeaseChecker informa se o inquilino tem contrato ACTIVE, para bloquear a exclusão.
type LeaseChecker interface {
	HasActiveLease(ctx context.Context, tenantID, orgID uuid.UUID) (bool, error)
}

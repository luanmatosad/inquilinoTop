package inspection

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/pkg/apierr"
)

const (
	TypeEntry = "ENTRY"
	TypeExit  = "EXIT"

	StatusDraft     = "DRAFT"
	StatusCompleted = "COMPLETED"

	ConditionGood          = "GOOD"
	ConditionFair          = "FAIR"
	ConditionPoor          = "POOR"
	ConditionDamaged       = "DAMAGED"
	ConditionNotApplicable = "NOT_APPLICABLE"
)

var (
	// ErrNotEditable: laudo COMPLETED é imutável (HTTP 409 INSPECTION_NOT_EDITABLE).
	ErrNotEditable = fmt.Errorf("inspection: laudo concluído não pode ser alterado: %w", apierr.ErrConflict)
	// ErrDuplicate: já existe laudo ativo do mesmo tipo no contrato (HTTP 409).
	ErrDuplicate = fmt.Errorf("inspection: já existe laudo ativo desse tipo no contrato: %w", apierr.ErrConflict)
	// ErrLeaseNotFound: contrato inexistente ou de outra organização (HTTP 404).
	ErrLeaseNotFound = fmt.Errorf("inspection: contrato não encontrado: %w", apierr.ErrNotFound)
	// ErrNoItems: concluir exige ao menos um item (HTTP 422).
	ErrNoItems = fmt.Errorf("inspection: o laudo precisa de ao menos um item para ser concluído")
	// ErrComparisonUnavailable: falta o laudo de entrada ou de saída concluído (HTTP 409).
	ErrComparisonUnavailable = fmt.Errorf("inspection: comparação exige laudos de entrada e de saída concluídos: %w", apierr.ErrConflict)
	// ErrInvalidFilter: filtro de listagem desconhecido (HTTP 400).
	ErrInvalidFilter = fmt.Errorf("inspection: filtro inválido")
)

type Inspection struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	LeaseID        uuid.UUID  `json:"lease_id"`
	Type           string     `json:"type"`
	Status         string     `json:"status"`
	InspectedAt    time.Time  `json:"inspected_at"`
	GeneralNotes   *string    `json:"general_notes,omitempty"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	IsActive       bool       `json:"is_active"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type Item struct {
	ID           uuid.UUID `json:"id"`
	InspectionID uuid.UUID `json:"inspection_id"`
	Room         string    `json:"room"`
	Item         string    `json:"item"`
	Condition    string    `json:"condition"`
	Notes        *string   `json:"notes,omitempty"`
	Position     int       `json:"position"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Detail é o laudo com seus itens ativos.
type Detail struct {
	Inspection
	Items []Item `json:"items"`
}

type CreateInspectionInput struct {
	LeaseID      uuid.UUID `json:"lease_id" validate:"required"`
	Type         string    `json:"type" validate:"required,oneof=ENTRY EXIT"`
	InspectedAt  time.Time `json:"inspected_at" validate:"required"`
	GeneralNotes *string   `json:"general_notes,omitempty" validate:"omitempty,max=4000"`
	// CopyFromEntry, num EXIT, copia os itens do ENTRY ativo do contrato para reavaliação.
	CopyFromEntry bool `json:"copy_from_entry,omitempty"`
}

type UpdateInspectionInput struct {
	InspectedAt  time.Time `json:"inspected_at" validate:"required"`
	GeneralNotes *string   `json:"general_notes,omitempty" validate:"omitempty,max=4000"`
}

type ItemInput struct {
	Room      string  `json:"room" validate:"required,max=100"`
	Item      string  `json:"item" validate:"required,max=150"`
	Condition string  `json:"condition" validate:"required,oneof=GOOD FAIR POOR DAMAGED NOT_APPLICABLE"`
	Notes     *string `json:"notes,omitempty" validate:"omitempty,max=2000"`
	Position  int     `json:"position,omitempty" validate:"omitempty,min=0"`
}

// Filter restringe a listagem; campos vazios não filtram.
type Filter struct {
	LeaseID *uuid.UUID
	Type    string
	Status  string
}

// ComparisonRow pareia um item da entrada com o da saída (chave: ambiente + item, sem caixa nem espaços nas pontas).
type ComparisonRow struct {
	Room           string  `json:"room"`
	Item           string  `json:"item"`
	EntryCondition *string `json:"entry_condition"`
	ExitCondition  *string `json:"exit_condition"`
	EntryNotes     *string `json:"entry_notes,omitempty"`
	ExitNotes      *string `json:"exit_notes,omitempty"`
	// Worsened é true quando a saída é pior que a entrada (GOOD < FAIR < POOR < DAMAGED).
	Worsened bool `json:"worsened"`
}

type Comparison struct {
	LeaseID uuid.UUID       `json:"lease_id"`
	Entry   Inspection      `json:"entry"`
	Exit    Inspection      `json:"exit"`
	Rows    []ComparisonRow `json:"rows"`
}

type Repository interface {
	Create(ctx context.Context, orgID uuid.UUID, in CreateInspectionInput) (*Inspection, error)
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*Inspection, error)
	// GetActiveByLeaseAndType devolve o laudo ativo do tipo no contrato, ou apierr.ErrNotFound.
	GetActiveByLeaseAndType(ctx context.Context, leaseID, orgID uuid.UUID, typ string) (*Inspection, error)
	List(ctx context.Context, orgID uuid.UUID, f Filter) ([]Inspection, error)
	// Update altera só laudos DRAFT; em COMPLETED devolve ErrNotEditable.
	Update(ctx context.Context, id, orgID uuid.UUID, in UpdateInspectionInput) (*Inspection, error)
	Delete(ctx context.Context, id, orgID uuid.UUID) error
	// Complete conclui só laudos DRAFT; em COMPLETED devolve ErrNotEditable.
	Complete(ctx context.Context, id, orgID uuid.UUID, at time.Time) (*Inspection, error)

	ListItems(ctx context.Context, inspectionID, orgID uuid.UUID) ([]Item, error)
	CreateItem(ctx context.Context, inspectionID, orgID uuid.UUID, in ItemInput) (*Item, error)
	UpdateItem(ctx context.Context, id, inspectionID, orgID uuid.UUID, in ItemInput) (*Item, error)
	DeleteItem(ctx context.Context, id, inspectionID, orgID uuid.UUID) error
	// CopyItems copia os itens ativos de from para to e devolve quantos copiou.
	CopyItems(ctx context.Context, fromID, toID, orgID uuid.UUID) (int, error)
}

// LeaseReader valida o contrato na organização; lease.Repository o satisfaz.
type LeaseReader interface {
	GetByID(ctx context.Context, id, orgID uuid.UUID) (*lease.Lease, error)
}

// Auditor registra criação e conclusão; *audit.Service o satisfaz. userAsOwner é o usuário
// (owner_id da auditoria é FK para users); a organização vem do contexto da requisição.
type Auditor interface {
	LogCreate(ctx context.Context, userAsOwner uuid.UUID, entityType string, entityID uuid.UUID, userID uuid.UUID, ipAddress string)
	LogUpdate(ctx context.Context, userAsOwner uuid.UUID, entityType string, entityID uuid.UUID, userID uuid.UUID, ipAddress string)
}

package inspection

import (
	"context"
	"fmt"
	"io"
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
	// ErrInvalidPhoto: arquivo que não é JPEG, PNG ou WebP, ou cujo conteúdo não bate com o tipo (HTTP 400).
	ErrInvalidPhoto = fmt.Errorf("inspection: a foto deve ser JPEG, PNG ou WebP")
	// ErrPhotoTooLarge: foto acima de MaxPhotoBytes (HTTP 413).
	ErrPhotoTooLarge = fmt.Errorf("inspection: a foto excede 10 MB")
	// ErrPhotoLimit: o item já tem MaxPhotosPerItem fotos (HTTP 422).
	ErrPhotoLimit = fmt.Errorf("inspection: o item já tem o máximo de fotos")
)

const (
	// MaxPhotoBytes é o tamanho máximo de cada foto (10 MB).
	MaxPhotoBytes = 10 << 20
	// MaxPhotosPerItem limita as fotos ativas de cada item.
	MaxPhotosPerItem = 10
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
	// Photos é preenchido só no detalhe do laudo; nunca nil.
	Photos []Photo `json:"photos"`
}

// Photo é a foto de um item. O caminho do arquivo não é exposto: a leitura passa pela API.
type Photo struct {
	ID        uuid.UUID `json:"id"`
	ItemID    uuid.UUID `json:"item_id"`
	Filename  string    `json:"filename"`
	MimeType  string    `json:"mime_type"`
	SizeBytes int       `json:"size_bytes"`
	CreatedAt time.Time `json:"created_at"`
}

// NewPhoto reúne os dados de uma foto já armazenada, para gravar no banco.
type NewPhoto struct {
	Filename  string
	MimeType  string
	SizeBytes int
	FilePath  string
}

// PhotoFile é a foto com o caminho no armazenamento (uso interno).
type PhotoFile struct {
	Photo
	FilePath string
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

	// CreatePhoto grava a foto do item (que deve ser do laudo e da organização) respeitando MaxPhotosPerItem:
	// ErrPhotoLimit se já houver o máximo, apierr.ErrNotFound se o item não for do laudo/organização.
	CreatePhoto(ctx context.Context, inspectionID, itemID, orgID, userID uuid.UUID, p NewPhoto) (*Photo, error)
	// ListPhotos devolve as fotos ativas dos itens ativos do laudo.
	ListPhotos(ctx context.Context, inspectionID, orgID uuid.UUID) ([]Photo, error)
	GetPhotoFile(ctx context.Context, photoID, orgID uuid.UUID) (*PhotoFile, error)
	// DeletePhoto faz soft-delete da foto do item do laudo.
	DeletePhoto(ctx context.Context, photoID, itemID, inspectionID, orgID uuid.UUID) error
}

// Storage guarda os arquivos das fotos; document.NewLocalStorage o satisfaz.
type Storage interface {
	Save(ctx context.Context, ownerID uuid.UUID, filename string, r io.Reader) (string, error)
	Load(ctx context.Context, path string) (io.ReadCloser, error)
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

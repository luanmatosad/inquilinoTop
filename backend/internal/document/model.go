package document

import (
	"context"
	"io"

	"github.com/google/uuid"
)

type Document struct {
	ID         uuid.UUID `json:"id"`
	OwnerID    uuid.UUID `json:"owner_id"`
	EntityType string    `json:"entity_type"`
	EntityID  uuid.UUID `json:"entity_id"`
	Filename  string    `json:"filename"`
	MimeType  string    `json:"mime_type"`
	SizeBytes int       `json:"size_bytes"`
	FilePath  string    `json:"file_path"`
	CreatedAt string    `json:"created_at"`
}

type CreateDocumentInput struct {
	EntityType string `json:"entity_type" validate:"required,oneof=property unit lease tenant"`
	EntityID   string `json:"entity_id" validate:"required,uuid"`
	Filename  string `json:"filename" validate:"required,max=255"`
	MimeType  string `json:"mime_type" validate:"required"`
	SizeBytes int    `json:"size_bytes" validate:"required,min=1,max=10485760"`
}

type Storage interface {
	Save(ctx context.Context, ownerID uuid.UUID, filename string, r io.Reader) (string, error)
	Load(ctx context.Context, path string) (io.ReadCloser, error)
	Delete(ctx context.Context, path string) error
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreateDocumentInput, filePath string) (*Document, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Document, error)
	ListByEntity(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID) ([]Document, error)
	Delete(ctx context.Context, id, ownerID uuid.UUID) error
}
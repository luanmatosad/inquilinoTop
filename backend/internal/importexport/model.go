package importexport

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type ImportHistory struct {
	ID               uuid.UUID  `json:"id"`
	OwnerID          uuid.UUID  `json:"owner_id"`
	FileName         string    `json:"file_name"`
	EntityType       string    `json:"entity_type"`
	TotalRows        int       `json:"total_rows"`
	SuccessfulRows   int       `json:"successful_rows"`
	FailedRows       int       `json:"failed_rows"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
}

type ImportRecord struct {
	Data map[string]string `json:"data"`
}

type ImportRequest struct {
	EntityType        string                   `json:"entity_type"`
	Records          []map[string]string       `json:"records"`
	DuplicateStrategy string                   `json:"duplicate_strategy"`
}

type ImportResponse struct {
	ImportID         uuid.UUID `json:"import_id"`
	Imported         int      `json:"imported"`
	Failed           int      `json:"failed"`
	Errors           []string `json:"errors"`
}

type Repository interface {
	CreateImportHistory(ctx context.Context, ownerID uuid.UUID, fileName, entityType string, totalRows int) (*ImportHistory, error)
	UpdateImportHistory(ctx context.Context, id uuid.UUID, successful, failed int, status string) error
	GetImportHistory(ctx context.Context, id, ownerID uuid.UUID) (*ImportHistory, error)
	ListImportHistory(ctx context.Context, ownerID uuid.UUID) ([]ImportHistory, error)
}
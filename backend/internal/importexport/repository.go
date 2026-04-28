package importexport

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct {
	db *db.DB
}

func NewRepository(d *db.DB) *pgRepository {
	return &pgRepository{db: d}
}

func (r *pgRepository) CreateImportHistory(ctx context.Context, ownerID uuid.UUID, fileName, entityType string, totalRows int) (*ImportHistory, error) {
	id := uuid.New()
	now := time.Now()

	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO import_history (id, owner_id, file_name, entity_type, total_rows, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, ownerID, fileName, entityType, totalRows, "PENDING", now)
	if err != nil {
		return nil, err
	}

	return &ImportHistory{
		ID:         id,
		OwnerID:    ownerID,
		FileName:   fileName,
		EntityType: entityType,
		TotalRows: totalRows,
		Status:    "PENDING",
		CreatedAt: now,
	}, nil
}

func (r *pgRepository) UpdateImportHistory(ctx context.Context, id uuid.UUID, successful, failed int, status string) error {
	now := time.Now()
	if status == "COMPLETED" || status == "FAILED" {
		_, err := r.db.Pool.Exec(ctx, `
			UPDATE import_history 
			SET successful_rows = $2, failed_rows = $3, status = $4, completed_at = $5
			WHERE id = $1
		`, id, successful, failed, status, now)
		return err
	}

	_, err := r.db.Pool.Exec(ctx, `
		UPDATE import_history 
		SET successful_rows = $2, failed_rows = $3, status = $4
		WHERE id = $1
	`, id, successful, failed, status)
	return err
}

func (r *pgRepository) GetImportHistory(ctx context.Context, id, ownerID uuid.UUID) (*ImportHistory, error) {
	var history ImportHistory
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, owner_id, file_name, entity_type, total_rows, successful_rows, failed_rows, status, created_at, completed_at
		FROM import_history
		WHERE id = $1 AND owner_id = $2
	`, id, ownerID).Scan(
		&history.ID, &history.OwnerID, &history.FileName, &history.EntityType,
		&history.TotalRows, &history.SuccessfulRows, &history.FailedRows,
		&history.Status, &history.CreatedAt, &history.CompletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &history, nil
}

func (r *pgRepository) ListImportHistory(ctx context.Context, ownerID uuid.UUID) ([]ImportHistory, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, owner_id, file_name, entity_type, total_rows, successful_rows, failed_rows, status, created_at, completed_at
		FROM import_history
		WHERE owner_id = $1
		ORDER BY created_at DESC
	`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []ImportHistory
	for rows.Next() {
		var h ImportHistory
		err := rows.Scan(
			&h.ID, &h.OwnerID, &h.FileName, &h.EntityType,
			&h.TotalRows, &h.SuccessfulRows, &h.FailedRows,
			&h.Status, &h.CreatedAt, &h.CompletedAt,
		)
		if err != nil {
			return nil, err
		}
		histories = append(histories, h)
	}
	return histories, nil
}
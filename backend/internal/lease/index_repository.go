package lease

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
)

type indexRepository struct {
	db *db.DB
}

func NewIndexRepository(db *db.DB) IndexRepository {
	return &indexRepository{db: db}
}

func (r *indexRepository) GetHistory(ctx context.Context, indexType string) ([]IndexValue, error) {
	query := `
		SELECT id, index_type, reference_month, value, cumulative, created_at
		FROM index_values
		WHERE index_type = $1
		ORDER BY reference_month DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, indexType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var indices []IndexValue
	for rows.Next() {
		var idx IndexValue
		if err := rows.Scan(
			&idx.ID, &idx.IndexType, &idx.ReferenceMonth,
			&idx.Value, &idx.Cumulative, &idx.CreatedAt,
		); err != nil {
			return nil, err
		}
		indices = append(indices, idx)
	}

	return indices, rows.Err()
}

func (r *indexRepository) GetLatest(ctx context.Context, indexType string) (*IndexValue, error) {
	query := `
		SELECT id, index_type, reference_month, value, cumulative, created_at
		FROM index_values
		WHERE index_type = $1
		ORDER BY reference_month DESC
		LIMIT 1
	`
	var idx IndexValue
	err := r.db.Pool.QueryRow(ctx, query, indexType).Scan(
		&idx.ID, &idx.IndexType, &idx.ReferenceMonth,
		&idx.Value, &idx.Cumulative, &idx.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, err
	}
	return &idx, nil
}

package document

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateDocumentInput, filePath string) (*Document, error) {
	entityID, err := uuid.Parse(in.EntityID)
	if err != nil {
		return nil, fmt.Errorf("document.repo: parse entity id: %w", err)
	}

	var doc Document
	var createdAt time.Time
	err = r.db.Pool.QueryRow(ctx,
		`INSERT INTO documents (owner_id, entity_type, entity_id, filename, mime_type, size_bytes, file_path)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, owner_id, entity_type, entity_id, filename, mime_type, size_bytes, file_path, created_at`,
		ownerID, in.EntityType, entityID, in.Filename, in.MimeType, in.SizeBytes, filePath,
	).Scan(&doc.ID, &doc.OwnerID, &doc.EntityType, &doc.EntityID, &doc.Filename, &doc.MimeType, &doc.SizeBytes, &doc.FilePath, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("document.repo: create: %w", err)
	}
	doc.CreatedAt = createdAt.Format(time.RFC3339)
	return &doc, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Document, error) {
	var doc Document
	var createdAt time.Time
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, entity_type, entity_id, filename, mime_type, size_bytes, file_path, created_at
		 FROM documents WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	).Scan(&doc.ID, &doc.OwnerID, &doc.EntityType, &doc.EntityID, &doc.Filename, &doc.MimeType, &doc.SizeBytes, &doc.FilePath, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("document.repo: get by id: %w", err)
	}
	doc.CreatedAt = createdAt.Format(time.RFC3339)
	return &doc, nil
}

func (r *pgRepository) ListByEntity(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID) ([]Document, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, owner_id, entity_type, entity_id, filename, mime_type, size_bytes, file_path, created_at
		 FROM documents WHERE owner_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY created_at DESC`,
		ownerID, entityType, entityID,
	)
	if err != nil {
		return nil, fmt.Errorf("document.repo: list by entity: %w", err)
	}
	defer rows.Close()
	var list []Document
	for rows.Next() {
		var doc Document
		var createdAt time.Time
		if err := rows.Scan(&doc.ID, &doc.OwnerID, &doc.EntityType, &doc.EntityID, &doc.Filename, &doc.MimeType, &doc.SizeBytes, &doc.FilePath, &createdAt); err != nil {
			return nil, fmt.Errorf("document.repo: list by entity scan: %w", err)
		}
		doc.CreatedAt = createdAt.Format(time.RFC3339)
		list = append(list, doc)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("document.repo: list by entity rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`DELETE FROM documents WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	)
	if err != nil {
		return fmt.Errorf("document.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}
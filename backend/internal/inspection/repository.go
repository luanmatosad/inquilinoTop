package inspection

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

const inspectionCols = `id, organization_id, lease_id, type, status, inspected_at, general_notes, completed_at, is_active, created_at, updated_at`

const itemCols = `id, inspection_id, room, item, condition, notes, position, is_active, created_at, updated_at`

func scanInspection(row pgx.Row, i *Inspection) error {
	return row.Scan(&i.ID, &i.OrganizationID, &i.LeaseID, &i.Type, &i.Status, &i.InspectedAt, &i.GeneralNotes, &i.CompletedAt, &i.IsActive, &i.CreatedAt, &i.UpdatedAt)
}

func scanItem(row pgx.Row, it *Item) error {
	return row.Scan(&it.ID, &it.InspectionID, &it.Room, &it.Item, &it.Condition, &it.Notes, &it.Position, &it.IsActive, &it.CreatedAt, &it.UpdatedAt)
}

// isUniqueViolation informa se err é violação (23505) do índice único constraint.
func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}

func (r *pgRepository) Create(ctx context.Context, orgID uuid.UUID, in CreateInspectionInput) (*Inspection, error) {
	var i Inspection
	err := scanInspection(r.db.Pool.QueryRow(ctx,
		`INSERT INTO inspections (organization_id, lease_id, type, inspected_at, general_notes)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+inspectionCols,
		orgID, in.LeaseID, in.Type, in.InspectedAt, in.GeneralNotes), &i)
	if err != nil {
		if isUniqueViolation(err, "uq_inspections_lease_type_active") {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("inspection.repo: create: %w", err)
	}
	return &i, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Inspection, error) {
	var i Inspection
	err := scanInspection(r.db.Pool.QueryRow(ctx,
		`SELECT `+inspectionCols+` FROM inspections WHERE id=$1 AND organization_id=$2 AND is_active=true`, id, orgID), &i)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("inspection.repo: get by id: %w", err)
	}
	return &i, nil
}

func (r *pgRepository) GetActiveByLeaseAndType(ctx context.Context, leaseID, orgID uuid.UUID, typ string) (*Inspection, error) {
	var i Inspection
	err := scanInspection(r.db.Pool.QueryRow(ctx,
		`SELECT `+inspectionCols+` FROM inspections WHERE lease_id=$1 AND organization_id=$2 AND type=$3 AND is_active=true`,
		leaseID, orgID, typ), &i)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("inspection.repo: get by lease and type: %w", err)
	}
	return &i, nil
}

func (r *pgRepository) List(ctx context.Context, orgID uuid.UUID, f Filter) ([]Inspection, error) {
	query := `SELECT ` + inspectionCols + ` FROM inspections WHERE organization_id=$1 AND is_active=true`
	args := []interface{}{orgID}
	add := func(cond string, v interface{}) {
		args = append(args, v)
		query += fmt.Sprintf(" AND "+cond, len(args))
	}
	if f.LeaseID != nil {
		add("lease_id=$%d", *f.LeaseID)
	}
	if f.Type != "" {
		add("type=$%d", f.Type)
	}
	if f.Status != "" {
		add("status=$%d", f.Status)
	}
	query += ` ORDER BY inspected_at DESC, created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("inspection.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Inspection
	for rows.Next() {
		var i Inspection
		if err := scanInspection(rows, &i); err != nil {
			return nil, fmt.Errorf("inspection.repo: list scan: %w", err)
		}
		list = append(list, i)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("inspection.repo: list rows: %w", err)
	}
	return list, nil
}

// notEditableOrNotFound distingue laudo COMPLETED (409) de inexistente (404) quando um UPDATE condicionado a DRAFT não casou.
func (r *pgRepository) notEditableOrNotFound(ctx context.Context, id, orgID uuid.UUID) error {
	var exists bool
	if err := r.db.Pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM inspections WHERE id=$1 AND organization_id=$2 AND is_active=true)`, id, orgID).Scan(&exists); err != nil {
		return fmt.Errorf("inspection.repo: checar existência: %w", err)
	}
	if exists {
		return ErrNotEditable
	}
	return apierr.ErrNotFound
}

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in UpdateInspectionInput) (*Inspection, error) {
	var i Inspection
	err := scanInspection(r.db.Pool.QueryRow(ctx,
		`UPDATE inspections SET inspected_at=$1, general_notes=$2, updated_at=NOW()
		 WHERE id=$3 AND organization_id=$4 AND is_active=true AND status='DRAFT'
		 RETURNING `+inspectionCols,
		in.InspectedAt, in.GeneralNotes, id, orgID), &i)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, r.notEditableOrNotFound(ctx, id, orgID)
		}
		return nil, fmt.Errorf("inspection.repo: update: %w", err)
	}
	return &i, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE inspections SET is_active=false, updated_at=NOW() WHERE id=$1 AND organization_id=$2 AND is_active=true`, id, orgID)
	if err != nil {
		return fmt.Errorf("inspection.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) Complete(ctx context.Context, id, orgID uuid.UUID, at time.Time) (*Inspection, error) {
	var i Inspection
	err := scanInspection(r.db.Pool.QueryRow(ctx,
		`UPDATE inspections SET status='COMPLETED', completed_at=$1, updated_at=NOW()
		 WHERE id=$2 AND organization_id=$3 AND is_active=true AND status='DRAFT'
		 RETURNING `+inspectionCols,
		at, id, orgID), &i)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, r.notEditableOrNotFound(ctx, id, orgID)
		}
		return nil, fmt.Errorf("inspection.repo: complete: %w", err)
	}
	return &i, nil
}

// ownedInspection é o filtro que prende um item à organização: nunca confiar só no id do item.
const ownedInspection = `inspection_id IN (SELECT id FROM inspections WHERE id=$%d AND organization_id=$%d AND is_active=true)`

func (r *pgRepository) ListItems(ctx context.Context, inspectionID, orgID uuid.UUID) ([]Item, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+itemCols+` FROM inspection_items
		 WHERE is_active=true AND `+fmt.Sprintf(ownedInspection, 1, 2)+`
		 ORDER BY position, created_at`, inspectionID, orgID)
	if err != nil {
		return nil, fmt.Errorf("inspection.repo: list items: %w", err)
	}
	defer rows.Close()
	var list []Item
	for rows.Next() {
		var it Item
		if err := scanItem(rows, &it); err != nil {
			return nil, fmt.Errorf("inspection.repo: list items scan: %w", err)
		}
		list = append(list, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("inspection.repo: list items rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) CreateItem(ctx context.Context, inspectionID, orgID uuid.UUID, in ItemInput) (*Item, error) {
	var it Item
	// Sem posição informada, vai para o fim. O SELECT só devolve linha se o laudo é da organização.
	err := scanItem(r.db.Pool.QueryRow(ctx,
		`INSERT INTO inspection_items (inspection_id, room, item, condition, notes, position)
		 SELECT n.id, $3, $4, $5, $6,
		        CASE WHEN $7 > 0 THEN $7
		             ELSE COALESCE((SELECT MAX(position) FROM inspection_items WHERE inspection_id=n.id AND is_active), 0) + 1 END
		   FROM inspections n
		  WHERE n.id=$1 AND n.organization_id=$2 AND n.is_active=true
		 RETURNING `+itemCols,
		inspectionID, orgID, in.Room, in.Item, in.Condition, in.Notes, in.Position), &it)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("inspection.repo: create item: %w", err)
	}
	return &it, nil
}

func (r *pgRepository) UpdateItem(ctx context.Context, id, inspectionID, orgID uuid.UUID, in ItemInput) (*Item, error) {
	var it Item
	err := scanItem(r.db.Pool.QueryRow(ctx,
		`UPDATE inspection_items
		    SET room=$1, item=$2, condition=$3, notes=$4, position=CASE WHEN $5 > 0 THEN $5 ELSE position END, updated_at=NOW()
		  WHERE id=$6 AND is_active=true AND `+fmt.Sprintf(ownedInspection, 7, 8)+`
		 RETURNING `+itemCols,
		in.Room, in.Item, in.Condition, in.Notes, in.Position, id, inspectionID, orgID), &it)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("inspection.repo: update item: %w", err)
	}
	return &it, nil
}

func (r *pgRepository) DeleteItem(ctx context.Context, id, inspectionID, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE inspection_items SET is_active=false, updated_at=NOW()
		  WHERE id=$1 AND is_active=true AND `+fmt.Sprintf(ownedInspection, 2, 3),
		id, inspectionID, orgID)
	if err != nil {
		return fmt.Errorf("inspection.repo: delete item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) CopyItems(ctx context.Context, fromID, toID, orgID uuid.UUID) (int, error) {
	// Os dois laudos precisam ser da organização; senão nada é copiado e o erro é 404.
	var both bool
	if err := r.db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) = 2 FROM inspections WHERE id = ANY($1) AND organization_id=$2 AND is_active=true`,
		[]uuid.UUID{fromID, toID}, orgID).Scan(&both); err != nil {
		return 0, fmt.Errorf("inspection.repo: copy items check: %w", err)
	}
	if !both {
		return 0, apierr.ErrNotFound
	}
	tag, err := r.db.Pool.Exec(ctx,
		`INSERT INTO inspection_items (inspection_id, room, item, condition, notes, position)
		 SELECT $2, room, item, condition, notes, position
		   FROM inspection_items WHERE inspection_id=$1 AND is_active=true`, fromID, toID)
	if err != nil {
		return 0, fmt.Errorf("inspection.repo: copy items: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

const photoCols = `p.id, p.inspection_item_id, p.filename, p.mime_type, p.size_bytes, p.created_at`

func scanPhoto(row pgx.Row, p *Photo) error {
	return row.Scan(&p.ID, &p.ItemID, &p.Filename, &p.MimeType, &p.SizeBytes, &p.CreatedAt)
}

func (r *pgRepository) CreatePhoto(ctx context.Context, inspectionID, itemID, orgID, userID uuid.UUID, in NewPhoto) (*Photo, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("inspection.repo: create photo begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Trava o item para o limite por item valer também com uploads simultâneos. O JOIN prende o item
	// ao laudo e à organização: nunca confiar só no id do item.
	var lockedID uuid.UUID
	err = tx.QueryRow(ctx,
		`SELECT it.id FROM inspection_items it
		   JOIN inspections n ON n.id = it.inspection_id
		  WHERE it.id=$1 AND it.is_active=true AND n.id=$2 AND n.organization_id=$3 AND n.is_active=true
		    FOR UPDATE OF it`, itemID, inspectionID, orgID).Scan(&lockedID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("inspection.repo: create photo lock: %w", err)
	}

	var count int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM inspection_photos WHERE inspection_item_id=$1 AND is_active=true`, itemID).Scan(&count); err != nil {
		return nil, fmt.Errorf("inspection.repo: create photo count: %w", err)
	}
	if count >= MaxPhotosPerItem {
		return nil, ErrPhotoLimit
	}

	var p Photo
	err = tx.QueryRow(ctx,
		`INSERT INTO inspection_photos (inspection_item_id, filename, mime_type, size_bytes, file_path, uploaded_by)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, inspection_item_id, filename, mime_type, size_bytes, created_at`,
		itemID, in.Filename, in.MimeType, in.SizeBytes, in.FilePath, userID,
	).Scan(&p.ID, &p.ItemID, &p.Filename, &p.MimeType, &p.SizeBytes, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inspection.repo: create photo: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("inspection.repo: create photo commit: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListPhotos(ctx context.Context, inspectionID, orgID uuid.UUID) ([]Photo, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+photoCols+` FROM inspection_photos p
		   JOIN inspection_items it ON it.id = p.inspection_item_id
		   JOIN inspections n ON n.id = it.inspection_id
		  WHERE n.id=$1 AND n.organization_id=$2 AND n.is_active=true AND it.is_active=true AND p.is_active=true
		  ORDER BY p.created_at`, inspectionID, orgID)
	if err != nil {
		return nil, fmt.Errorf("inspection.repo: list photos: %w", err)
	}
	defer rows.Close()
	var list []Photo
	for rows.Next() {
		var p Photo
		if err := scanPhoto(rows, &p); err != nil {
			return nil, fmt.Errorf("inspection.repo: list photos scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("inspection.repo: list photos rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) GetPhotoFile(ctx context.Context, photoID, orgID uuid.UUID) (*PhotoFile, error) {
	var pf PhotoFile
	err := r.db.Pool.QueryRow(ctx,
		`SELECT `+photoCols+`, p.file_path FROM inspection_photos p
		   JOIN inspection_items it ON it.id = p.inspection_item_id
		   JOIN inspections n ON n.id = it.inspection_id
		  WHERE p.id=$1 AND n.organization_id=$2 AND n.is_active=true AND it.is_active=true AND p.is_active=true`,
		photoID, orgID,
	).Scan(&pf.ID, &pf.ItemID, &pf.Filename, &pf.MimeType, &pf.SizeBytes, &pf.CreatedAt, &pf.FilePath)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("inspection.repo: get photo: %w", err)
	}
	return &pf, nil
}

func (r *pgRepository) DeletePhoto(ctx context.Context, photoID, itemID, inspectionID, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE inspection_photos SET is_active=false
		  WHERE id=$1 AND is_active=true AND inspection_item_id IN (
		    SELECT it.id FROM inspection_items it JOIN inspections n ON n.id = it.inspection_id
		     WHERE it.id=$2 AND it.is_active=true AND n.id=$3 AND n.organization_id=$4 AND n.is_active=true)`,
		photoID, itemID, inspectionID, orgID)
	if err != nil {
		return fmt.Errorf("inspection.repo: delete photo: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

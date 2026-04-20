package property

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO properties (owner_id, type, name, address_line, city, state)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at`,
		ownerID, in.Type, in.Name, in.AddressLine, in.City, in.State,
	).Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at
		 FROM properties WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) List(ctx context.Context, ownerID uuid.UUID) ([]Property, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at
		 FROM properties WHERE owner_id=$1 AND is_active=true ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("property.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Property
	for rows.Next() {
		var p Property
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("property.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("property.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, ownerID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE properties SET type=$1, name=$2, address_line=$3, city=$4, state=$5, updated_at=NOW()
		 WHERE id=$6 AND owner_id=$7 AND is_active=true
		 RETURNING id, owner_id, type, name, address_line, city, state, is_active, created_at, updated_at`,
		in.Type, in.Name, in.AddressLine, in.City, in.State, id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE properties SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	)
	if err != nil {
		return fmt.Errorf("property.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) CreateUnit(ctx context.Context, propertyID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO units (property_id, label, floor, notes) VALUES ($1,$2,$3,$4)
		 RETURNING id, property_id, label, floor, notes, is_active, created_at, updated_at`,
		propertyID, in.Label, in.Floor, in.Notes,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: create unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUnit(ctx context.Context, id uuid.UUID) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, property_id, label, floor, notes, is_active, created_at, updated_at
		 FROM units WHERE id=$1 AND is_active=true`,
		id,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: get unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, property_id, label, floor, notes, is_active, created_at, updated_at
		 FROM units WHERE property_id=$1 AND is_active=true ORDER BY label`,
		propertyID,
	)
	if err != nil {
		return nil, fmt.Errorf("property.repo: list units: %w", err)
	}
	defer rows.Close()
	var list []Unit
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("property.repo: list units scan: %w", err)
		}
		list = append(list, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("property.repo: list units rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) UpdateUnit(ctx context.Context, id uuid.UUID, in CreateUnitInput) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE units SET label=$1, floor=$2, notes=$3, updated_at=NOW()
		 WHERE id=$4 AND is_active=true
		 RETURNING id, property_id, label, floor, notes, is_active, created_at, updated_at`,
		in.Label, in.Floor, in.Notes, id,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: update unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) DeleteUnit(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE units SET is_active=false, updated_at=NOW() WHERE id=$1 AND is_active=true`, id,
	)
	if err != nil {
		return fmt.Errorf("property.repo: delete unit: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

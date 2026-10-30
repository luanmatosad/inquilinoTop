package property

import (
	"context"
	"errors"
	"fmt"

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

func (r *pgRepository) Create(ctx context.Context, userID, orgID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO properties (organization_id, owner_id, type, name, address_line, city, state, postal_code, neighborhood)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING id, organization_id, type, name, address_line, city, state, postal_code, neighborhood, is_active, created_at, updated_at`,
		orgID, userID, in.Type, in.Name, in.AddressLine, in.City, in.State, in.PostalCode, in.Neighborhood,
	).Scan(&p.ID, &p.OrganizationID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.PostalCode, &p.Neighborhood, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, type, name, address_line, city, state, postal_code, neighborhood, is_active, created_at, updated_at
		 FROM properties WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	).Scan(&p.ID, &p.OrganizationID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.PostalCode, &p.Neighborhood, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("property.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) List(ctx context.Context, orgID uuid.UUID) ([]Property, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, organization_id, type, name, address_line, city, state, postal_code, neighborhood, is_active, created_at, updated_at
		 FROM properties WHERE organization_id=$1 AND is_active=true ORDER BY created_at DESC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("property.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Property
	for rows.Next() {
		var p Property
		if err := rows.Scan(&p.ID, &p.OrganizationID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.PostalCode, &p.Neighborhood, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("property.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("property.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in CreatePropertyInput) (*Property, error) {
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE properties SET type=$1, name=$2, address_line=$3, city=$4, state=$5, postal_code=$6, neighborhood=$7, updated_at=NOW()
		 WHERE id=$8 AND organization_id=$9 AND is_active=true
		 RETURNING id, organization_id, type, name, address_line, city, state, postal_code, neighborhood, is_active, created_at, updated_at`,
		in.Type, in.Name, in.AddressLine, in.City, in.State, in.PostalCode, in.Neighborhood, id, orgID,
	).Scan(&p.ID, &p.OrganizationID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.PostalCode, &p.Neighborhood, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("property.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE properties SET is_active=false, updated_at=NOW() WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
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
		`INSERT INTO units (property_id, label, floor, notes, area_m2, bedrooms, bathrooms) VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, property_id, label, floor, notes, area_m2, bedrooms, bathrooms, is_active, created_at, updated_at`,
		propertyID, in.Label, in.Floor, in.Notes, in.AreaM2, in.Bedrooms, in.Bathrooms,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.AreaM2, &u.Bedrooms, &u.Bathrooms, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err, "uq_units_property_label_active") {
			return nil, ErrDuplicateUnitLabel
		}
		return nil, fmt.Errorf("property.repo: create unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUnit(ctx context.Context, id, orgID uuid.UUID) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`SELECT u.id, u.property_id, u.label, u.floor, u.notes, u.area_m2, u.bedrooms, u.bathrooms, u.is_active, u.created_at, u.updated_at
		 FROM units u
		 JOIN properties p ON p.id = u.property_id
		 WHERE u.id=$1 AND p.organization_id=$2 AND u.is_active=true AND p.is_active=true`,
		id, orgID,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.AreaM2, &u.Bedrooms, &u.Bathrooms, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("property.repo: get unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) ListUnits(ctx context.Context, propertyID uuid.UUID) ([]Unit, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, property_id, label, floor, notes, area_m2, bedrooms, bathrooms, is_active, created_at, updated_at
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
		if err := rows.Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.AreaM2, &u.Bedrooms, &u.Bathrooms, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("property.repo: list units scan: %w", err)
		}
		list = append(list, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("property.repo: list units rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) UpdateUnit(ctx context.Context, id, orgID uuid.UUID, in CreateUnitInput) (*Unit, error) {
	var u Unit
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE units SET label=$1, floor=$2, notes=$3, area_m2=$4, bedrooms=$5, bathrooms=$6, updated_at=NOW()
		 WHERE id=$7 AND is_active=true
		   AND property_id IN (SELECT id FROM properties WHERE organization_id=$8 AND is_active=true)
		 RETURNING id, property_id, label, floor, notes, area_m2, bedrooms, bathrooms, is_active, created_at, updated_at`,
		in.Label, in.Floor, in.Notes, in.AreaM2, in.Bedrooms, in.Bathrooms, id, orgID,
	).Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.AreaM2, &u.Bedrooms, &u.Bathrooms, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		if isUniqueViolation(err, "uq_units_property_label_active") {
			return nil, ErrDuplicateUnitLabel
		}
		return nil, fmt.Errorf("property.repo: update unit: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) DeleteUnit(ctx context.Context, id, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE units SET is_active=false, updated_at=NOW()
		 WHERE id=$1 AND is_active=true
		   AND property_id IN (SELECT id FROM properties WHERE organization_id=$2 AND is_active=true)`,
		id, orgID,
	)
	if err != nil {
		return fmt.Errorf("property.repo: delete unit: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) ListUnitsByPropertyIDs(ctx context.Context, propertyIDs []uuid.UUID) ([]Unit, error) {
	if len(propertyIDs) == 0 {
		return nil, nil
	}
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, property_id, label, floor, notes, area_m2, bedrooms, bathrooms, is_active, created_at, updated_at
		 FROM units WHERE property_id = ANY($1) AND is_active=true ORDER BY property_id, label`,
		propertyIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("property.repo: list units by property ids: %w", err)
	}
	defer rows.Close()
	var list []Unit
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.PropertyID, &u.Label, &u.Floor, &u.Notes, &u.AreaM2, &u.Bedrooms, &u.Bathrooms, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("property.repo: list units by property ids scan: %w", err)
		}
		list = append(list, u)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("property.repo: list units by property ids rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) GetByField(ctx context.Context, orgID uuid.UUID, field string, value string) (*Property, error) {
	if field != "name" {
		return nil, fmt.Errorf("property.repo: unsupported field %s", field)
	}
	var p Property
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, type, name, address_line, city, state, postal_code, neighborhood, is_active, created_at, updated_at
		 FROM properties WHERE organization_id=$1 AND LOWER(name)=LOWER($2) AND is_active=true`,
		orgID, value,
	).Scan(&p.ID, &p.OrganizationID, &p.Type, &p.Name, &p.AddressLine, &p.City, &p.State, &p.PostalCode, &p.Neighborhood, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("property.repo: get by field: %w", err)
	}
	return &p, nil
}

// isUniqueViolation informa se err é violação (23505) do índice único constraint.
func isUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}

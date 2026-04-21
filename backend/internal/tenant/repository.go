package tenant

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

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO tenants (owner_id, name, email, phone, document, person_type)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, owner_id, name, email, phone, document, person_type, is_active, created_at, updated_at`,
		ownerID, in.Name, in.Email, in.Phone, in.Document, pt,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: create: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, name, email, phone, document, person_type, is_active, created_at, updated_at
		 FROM tenants WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: get by id: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) List(ctx context.Context, ownerID uuid.UUID) ([]Tenant, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, owner_id, name, email, phone, document, person_type, is_active, created_at, updated_at
		 FROM tenants WHERE owner_id=$1 AND is_active=true ORDER BY name`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Tenant
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("tenant.repo: list scan: %w", err)
		}
		list = append(list, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("tenant.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE tenants SET name=$1, email=$2, phone=$3, document=$4, person_type=$5, updated_at=NOW()
		 WHERE id=$6 AND owner_id=$7 AND is_active=true
		 RETURNING id, owner_id, name, email, phone, document, person_type, is_active, created_at, updated_at`,
		in.Name, in.Email, in.Phone, in.Document, pt, id, ownerID,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: update: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE tenants SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	)
	if err != nil {
		return fmt.Errorf("tenant.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

package tenant

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, name, email, phone, document)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, owner_id, name, email, phone, document, is_active, created_at, updated_at`,
		ownerID, in.Name, in.Email, in.Phone, in.Document,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: create: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, name, email, phone, document, is_active, created_at, updated_at
		 FROM tenants WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: get by id: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) List(ownerID uuid.UUID) ([]Tenant, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, name, email, phone, document, is_active, created_at, updated_at
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
		rows.Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
		list = append(list, t)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE tenants SET name=$1, email=$2, phone=$3, document=$4, updated_at=NOW()
		 WHERE id=$5 AND owner_id=$6 AND is_active=true
		 RETURNING id, owner_id, name, email, phone, document, is_active, created_at, updated_at`,
		in.Name, in.Email, in.Phone, in.Document, id, ownerID,
	).Scan(&t.ID, &t.OwnerID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: update: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) Delete(id, ownerID uuid.UUID) error {
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE tenants SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	)
	return err
}

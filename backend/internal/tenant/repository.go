package tenant

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

func (r *pgRepository) Create(ctx context.Context, userID, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO tenants (organization_id, owner_id, name, email, phone, document, person_type, postal_code, address_line, city, state, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id, organization_id, name, email, phone, document, person_type, postal_code, address_line, city, state, notes, is_active, created_at, updated_at`,
		orgID, userID, in.Name, in.Email, in.Phone, in.Document, pt, in.PostalCode, in.AddressLine, in.City, in.State, in.Notes,
	).Scan(&t.ID, &t.OrganizationID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.PostalCode, &t.AddressLine, &t.City, &t.State, &t.Notes, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if isDocumentViolation(err) {
			return nil, ErrDuplicateDocument
		}
		return nil, fmt.Errorf("tenant.repo: create: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Tenant, error) {
	var t Tenant
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, name, email, phone, document, person_type, postal_code, address_line, city, state, notes, is_active, created_at, updated_at
		 FROM tenants WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	).Scan(&t.ID, &t.OrganizationID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.PostalCode, &t.AddressLine, &t.City, &t.State, &t.Notes, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("tenant.repo: get by id: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) List(ctx context.Context, orgID uuid.UUID) ([]Tenant, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, organization_id, name, email, phone, document, person_type, postal_code, address_line, city, state, notes, is_active, created_at, updated_at
		 FROM tenants WHERE organization_id=$1 AND is_active=true ORDER BY name`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("tenant.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Tenant
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(&t.ID, &t.OrganizationID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.PostalCode, &t.AddressLine, &t.City, &t.State, &t.Notes, &t.IsActive, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("tenant.repo: list scan: %w", err)
		}
		list = append(list, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("tenant.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	var t Tenant
	pt := "PF"
	if in.PersonType != nil {
		pt = *in.PersonType
	}
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE tenants SET name=$1, email=$2, phone=$3, document=$4, person_type=$5,
		        postal_code=$6, address_line=$7, city=$8, state=$9, notes=$10, updated_at=NOW()
		 WHERE id=$11 AND organization_id=$12 AND is_active=true
		 RETURNING id, organization_id, name, email, phone, document, person_type, postal_code, address_line, city, state, notes, is_active, created_at, updated_at`,
		in.Name, in.Email, in.Phone, in.Document, pt, in.PostalCode, in.AddressLine, in.City, in.State, in.Notes, id, orgID,
	).Scan(&t.ID, &t.OrganizationID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.PostalCode, &t.AddressLine, &t.City, &t.State, &t.Notes, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		if isDocumentViolation(err) {
			return nil, ErrDuplicateDocument
		}
		return nil, fmt.Errorf("tenant.repo: update: %w", err)
	}
	return &t, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE tenants SET is_active=false, updated_at=NOW() WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	)
	if err != nil {
		return fmt.Errorf("tenant.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) GetByField(ctx context.Context, orgID uuid.UUID, field string, value string) (*Tenant, error) {
	var t Tenant
	var err error
	switch field {
	case "document":
		err = r.db.Pool.QueryRow(ctx,
			`SELECT id, organization_id, name, email, phone, document, person_type, postal_code, address_line, city, state, notes, is_active, created_at, updated_at
			 FROM tenants WHERE organization_id=$1 AND document=$2 AND is_active=true`,
			orgID, value,
		).Scan(&t.ID, &t.OrganizationID, &t.Name, &t.Email, &t.Phone, &t.Document, &t.PersonType, &t.PostalCode, &t.AddressLine, &t.City, &t.State, &t.Notes, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	default:
		return nil, fmt.Errorf("tenant.repo: unsupported field %s", field)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("tenant.repo: get by field: %w", err)
	}
	return &t, nil
}

// isDocumentViolation informa se err é violação do índice único de documento por organização.
func isDocumentViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "uq_tenants_org_document_active"
}

type pgLeaseChecker struct{ db *db.DB }

// NewLeaseChecker cria o LeaseChecker que consulta contratos ACTIVE no banco.
func NewLeaseChecker(database *db.DB) LeaseChecker {
	return &pgLeaseChecker{db: database}
}

func (c *pgLeaseChecker) HasActiveLease(ctx context.Context, tenantID, orgID uuid.UUID) (bool, error) {
	var active bool
	err := c.db.Pool.QueryRow(ctx,
		`SELECT EXISTS (
		   SELECT 1 FROM leases
		   WHERE tenant_id=$1 AND organization_id=$2 AND status='ACTIVE' AND is_active=true)`,
		tenantID, orgID,
	).Scan(&active)
	if err != nil {
		return false, fmt.Errorf("tenant.repo: has active lease: %w", err)
	}
	return active, nil
}

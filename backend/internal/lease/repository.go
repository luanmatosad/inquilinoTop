package lease

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

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO leases (owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
		ownerID, in.UnitID, in.TenantID, in.StartDate, in.EndDate, in.RentAmount, in.DepositAmount,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: create: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at
		 FROM leases WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: get by id: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) List(ctx context.Context, ownerID uuid.UUID) ([]Lease, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at
		 FROM leases WHERE owner_id=$1 AND is_active=true ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Lease
	for rows.Next() {
		var l Lease
		if err := rows.Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, fmt.Errorf("lease.repo: list scan: %w", err)
		}
		list = append(list, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lease.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET end_date=$1, rent_amount=$2, deposit_amount=$3, status=$4, updated_at=NOW()
		 WHERE id=$5 AND owner_id=$6 AND is_active=true
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
		in.EndDate, in.RentAmount, in.DepositAmount, in.Status, id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: update: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE leases SET is_active=false, updated_at=NOW() WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	)
	if err != nil {
		return fmt.Errorf("lease.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) End(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	now := time.Now()
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET status='ENDED', end_date=$1, updated_at=NOW()
		 WHERE id=$2 AND owner_id=$3 AND is_active=true
		 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
		now, id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: end: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) Renew(ctx context.Context, id, ownerID uuid.UUID, in RenewLeaseInput) (*Lease, error) {
	var l Lease
	var err error
	if in.RentAmount > 0 {
		err = r.db.Pool.QueryRow(ctx,
			`UPDATE leases SET status='ACTIVE', end_date=$1, rent_amount=$2, updated_at=NOW()
			 WHERE id=$3 AND owner_id=$4 AND is_active=true
			 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
			in.NewEndDate, in.RentAmount, id, ownerID,
		).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	} else {
		err = r.db.Pool.QueryRow(ctx,
			`UPDATE leases SET status='ACTIVE', end_date=$1, updated_at=NOW()
			 WHERE id=$2 AND owner_id=$3 AND is_active=true
			 RETURNING id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, status, is_active, created_at, updated_at`,
			in.NewEndDate, id, ownerID,
		).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.Status, &l.IsActive, &l.CreatedAt, &l.UpdatedAt)
	}
	if err != nil {
		return nil, fmt.Errorf("lease.repo: renew: %w", err)
	}
	return &l, nil
}

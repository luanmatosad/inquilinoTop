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

const leaseCols = `id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, payment_day,
	status, is_active, late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year, created_at, updated_at`

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO leases (owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, payment_day,
			late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING `+leaseCols,
		ownerID, in.UnitID, in.TenantID, in.StartDate, in.EndDate, in.RentAmount, in.DepositAmount, in.PaymentDay,
		in.LateFeePercent, in.DailyInterestPercent, in.IPTUReimbursable, in.AnnualIPTUAmount, in.IPTUYear,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: create: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`SELECT `+leaseCols+` FROM leases WHERE id=$1 AND owner_id=$2 AND is_active=true`,
		id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: get by id: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) List(ctx context.Context, ownerID uuid.UUID) ([]Lease, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+leaseCols+` FROM leases WHERE owner_id=$1 AND is_active=true ORDER BY created_at DESC`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Lease
	for rows.Next() {
		var l Lease
		if err := rows.Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
			&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
			&l.CreatedAt, &l.UpdatedAt); err != nil {
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
	paymentDay := in.PaymentDay
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET end_date=$1, rent_amount=$2, deposit_amount=$3, status=$4, payment_day=COALESCE($5, payment_day),
			late_fee_percent=$6, daily_interest_percent=$7, iptu_reimbursable=$8, annual_iptu_amount=$9, iptu_year=$10, updated_at=NOW()
		 WHERE id=$11 AND owner_id=$12 AND is_active=true
		 RETURNING `+leaseCols,
		in.EndDate, in.RentAmount, in.DepositAmount, in.Status, paymentDay,
		in.LateFeePercent, in.DailyInterestPercent, in.IPTUReimbursable, in.AnnualIPTUAmount, in.IPTUYear,
		id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.CreatedAt, &l.UpdatedAt)
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
		 RETURNING `+leaseCols,
		now, id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: end: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) Renew(ctx context.Context, id, ownerID uuid.UUID, in RenewLeaseInput) (*Lease, error) {
	var l Lease
	var err error
	paymentDay := in.PaymentDay
	if in.RentAmount > 0 {
		err = r.db.Pool.QueryRow(ctx,
			`UPDATE leases SET status='ACTIVE', end_date=$1, rent_amount=$2, payment_day=COALESCE($3, payment_day), updated_at=NOW()
			 WHERE id=$4 AND owner_id=$5 AND is_active=true
			 RETURNING `+leaseCols,
			in.NewEndDate, in.RentAmount, paymentDay, id, ownerID,
		).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
			&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
			&l.CreatedAt, &l.UpdatedAt)
	} else {
		err = r.db.Pool.QueryRow(ctx,
			`UPDATE leases SET status='ACTIVE', end_date=$1, payment_day=COALESCE($2, payment_day), updated_at=NOW()
			 WHERE id=$3 AND owner_id=$4 AND is_active=true
			 RETURNING `+leaseCols,
			in.NewEndDate, paymentDay, id, ownerID,
		).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
			&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
			&l.CreatedAt, &l.UpdatedAt)
	}
	if err != nil {
		return nil, fmt.Errorf("lease.repo: renew: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) UpdateRentAmount(ctx context.Context, id, ownerID uuid.UUID, amount float64) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET rent_amount=$1, updated_at=NOW()
		 WHERE id=$2 AND owner_id=$3 AND is_active=true
		 RETURNING `+leaseCols,
		amount, id, ownerID,
	).Scan(&l.ID, &l.OwnerID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: update rent: %w", err)
	}
	return &l, nil
}

type pgReadjustmentRepository struct{ db *db.DB }

func NewReadjustmentRepository(database *db.DB) ReadjustmentRepository {
	return &pgReadjustmentRepository{db: database}
}

func (r *pgReadjustmentRepository) Create(ctx context.Context, in *Readjustment) (*Readjustment, error) {
	var out Readjustment
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO lease_readjustments
		   (lease_id, owner_id, applied_at, old_amount, new_amount, percentage, index_name, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING id, lease_id, owner_id, applied_at, old_amount, new_amount, percentage, index_name, notes, created_at`,
		in.LeaseID, in.OwnerID, in.AppliedAt, in.OldAmount, in.NewAmount, in.Percentage, in.IndexName, in.Notes,
	).Scan(&out.ID, &out.LeaseID, &out.OwnerID, &out.AppliedAt, &out.OldAmount, &out.NewAmount,
		&out.Percentage, &out.IndexName, &out.Notes, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.readj.repo: create: %w", err)
	}
	return &out, nil
}

func (r *pgReadjustmentRepository) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Readjustment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, lease_id, owner_id, applied_at, old_amount, new_amount, percentage, index_name, notes, created_at
		 FROM lease_readjustments WHERE lease_id=$1 AND owner_id=$2 ORDER BY applied_at DESC`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.readj.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Readjustment
	for rows.Next() {
		var r Readjustment
		if err := rows.Scan(&r.ID, &r.LeaseID, &r.OwnerID, &r.AppliedAt, &r.OldAmount, &r.NewAmount,
			&r.Percentage, &r.IndexName, &r.Notes, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("lease.readj.repo: list scan: %w", err)
		}
		list = append(list, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lease.readj.repo: list rows: %w", err)
	}
	return list, nil
}

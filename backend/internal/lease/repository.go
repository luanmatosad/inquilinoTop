package lease

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

const leaseCols = `id, organization_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, payment_day,
	status, is_active, late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year, notes, created_at, updated_at`

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, orgID uuid.UUID, ownerID uuid.UUID, in CreateLeaseInput) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO leases (organization_id, owner_id, unit_id, tenant_id, start_date, end_date, rent_amount, deposit_amount, payment_day,
			late_fee_percent, daily_interest_percent, iptu_reimbursable, annual_iptu_amount, iptu_year, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		 RETURNING `+leaseCols,
		orgID, ownerID, in.UnitID, in.TenantID, in.StartDate, in.EndDate, in.RentAmount, in.DepositAmount, in.PaymentDay,
		in.LateFeePercent, in.DailyInterestPercent, in.IPTUReimbursable, in.AnnualIPTUAmount, in.IPTUYear, in.Notes,
	).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		if isOverlapViolation(err) {
			return nil, ErrLeaseOverlap
		}
		return nil, fmt.Errorf("lease.repo: create: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`SELECT `+leaseCols+` FROM leases WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("lease.repo: get by id: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) List(ctx context.Context, orgID uuid.UUID) ([]Lease, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+leaseCols+` FROM leases WHERE organization_id=$1 AND is_active=true ORDER BY created_at DESC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Lease
	for rows.Next() {
		var l Lease
		if err := rows.Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
			&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
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

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in UpdateLeaseInput) (*Lease, error) {
	paymentDay := in.PaymentDay
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET end_date=$1, rent_amount=$2, deposit_amount=$3, status=$4, payment_day=COALESCE($5, payment_day),
			late_fee_percent=$6, daily_interest_percent=$7, iptu_reimbursable=$8, annual_iptu_amount=$9, iptu_year=$10, notes=$11, updated_at=NOW()
		 WHERE id=$12 AND organization_id=$13 AND is_active=true
		 RETURNING `+leaseCols,
		in.EndDate, in.RentAmount, in.DepositAmount, in.Status, paymentDay,
		in.LateFeePercent, in.DailyInterestPercent, in.IPTUReimbursable, in.AnnualIPTUAmount, in.IPTUYear, in.Notes,
		id, orgID,
	).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		if isOverlapViolation(err) {
			return nil, ErrLeaseOverlap
		}
		return nil, fmt.Errorf("lease.repo: update: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE leases SET is_active=false, updated_at=NOW() WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	)
	if err != nil {
		return fmt.Errorf("lease.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

func (r *pgRepository) End(ctx context.Context, id, orgID uuid.UUID) (*Lease, error) {
	now := time.Now()
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET status='ENDED', end_date=LEAST(COALESCE(end_date, $1::date), $1::date), updated_at=NOW()
		 WHERE id=$2 AND organization_id=$3 AND is_active=true AND status='ACTIVE'
		 RETURNING `+leaseCols,
		now, id, orgID,
	).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
		&l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLeaseNotActive
		}
		return nil, fmt.Errorf("lease.repo: end: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) Renew(ctx context.Context, id, orgID uuid.UUID, in RenewLeaseInput) (*Lease, error) {
	var l Lease
	var err error
	paymentDay := in.PaymentDay
	if in.RentAmount > 0 {
		err = r.db.Pool.QueryRow(ctx,
			`UPDATE leases SET status='ACTIVE', end_date=$1, rent_amount=$2, payment_day=COALESCE($3, payment_day), updated_at=NOW()
			 WHERE id=$4 AND organization_id=$5 AND is_active=true
			 RETURNING `+leaseCols,
			in.NewEndDate, in.RentAmount, paymentDay, id, orgID,
		).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
			&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
			&l.CreatedAt, &l.UpdatedAt)
	} else {
		err = r.db.Pool.QueryRow(ctx,
			`UPDATE leases SET status='ACTIVE', end_date=$1, payment_day=COALESCE($2, payment_day), updated_at=NOW()
			 WHERE id=$3 AND organization_id=$4 AND is_active=true
			 RETURNING `+leaseCols,
			in.NewEndDate, paymentDay, id, orgID,
		).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
			&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
			&l.CreatedAt, &l.UpdatedAt)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		if isOverlapViolation(err) {
			return nil, ErrLeaseOverlap
		}
		return nil, fmt.Errorf("lease.repo: renew: %w", err)
	}
	return &l, nil
}

func (r *pgRepository) UpdateRentAmount(ctx context.Context, id, orgID uuid.UUID, amount float64) (*Lease, error) {
	var l Lease
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE leases SET rent_amount=$1, updated_at=NOW()
		 WHERE id=$2 AND organization_id=$3 AND is_active=true
		 RETURNING `+leaseCols,
		amount, id, orgID,
	).Scan(&l.ID, &l.OrganizationID, &l.UnitID, &l.TenantID, &l.StartDate, &l.EndDate, &l.RentAmount, &l.DepositAmount, &l.PaymentDay,
		&l.Status, &l.IsActive, &l.LateFeePercent, &l.DailyInterestPercent, &l.IPTUReimbursable, &l.AnnualIPTUAmount, &l.IPTUYear, &l.Notes,
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
		   (lease_id, organization_id, applied_at, old_amount, new_amount, percentage, index_name, notes)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		 RETURNING id, lease_id, organization_id, applied_at, old_amount, new_amount, percentage, index_name, notes, created_at`,
		in.LeaseID, in.OrganizationID, in.AppliedAt, in.OldAmount, in.NewAmount, in.Percentage, in.IndexName, in.Notes,
	).Scan(&out.ID, &out.LeaseID, &out.OrganizationID, &out.AppliedAt, &out.OldAmount, &out.NewAmount,
		&out.Percentage, &out.IndexName, &out.Notes, &out.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("lease.readj.repo: create: %w", err)
	}
	return &out, nil
}

func (r *pgReadjustmentRepository) ListByLease(ctx context.Context, leaseID, orgID uuid.UUID) ([]Readjustment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, lease_id, organization_id, applied_at, old_amount, new_amount, percentage, index_name, notes, created_at
		 FROM lease_readjustments WHERE lease_id=$1 AND organization_id=$2 ORDER BY applied_at DESC`,
		leaseID, orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("lease.readj.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Readjustment
	for rows.Next() {
		var r Readjustment
		if err := rows.Scan(&r.ID, &r.LeaseID, &r.OrganizationID, &r.AppliedAt, &r.OldAmount, &r.NewAmount,
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

// isOverlapViolation informa se err é a violação da EXCLUDE leases_no_overlap_per_unit (23P01).
func isOverlapViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23P01" && pgErr.ConstraintName == "leases_no_overlap_per_unit"
}

func (r *pgRepository) HasOverlap(ctx context.Context, unitID, orgID uuid.UUID, start time.Time, end *time.Time, exceptID uuid.UUID) (bool, error) {
	var overlap bool
	err := r.db.Pool.QueryRow(ctx,
		`SELECT EXISTS (
		   SELECT 1 FROM leases
		   WHERE unit_id=$1 AND organization_id=$2 AND status='ACTIVE' AND is_active=true AND id <> $3
		     AND daterange(start_date, end_date, '[]') && daterange($4::date, $5::date, '[]'))`,
		unitID, orgID, exceptID, start, end,
	).Scan(&overlap)
	if err != nil {
		return false, fmt.Errorf("lease.repo: has overlap: %w", err)
	}
	return overlap, nil
}

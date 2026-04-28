package payment

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

var ErrNotFound = apierr.ErrNotFound

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

const paymentCols = `id, owner_id, lease_id, due_date, paid_date,
  gross_amount, late_fee_amount, interest_amount, irrf_amount, net_amount,
  competency, description, status, type, created_at, updated_at`

func scanPayment(row pgx.Row, p *Payment) error {
	return row.Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate,
		&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount,
		&p.Competency, &p.Description, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
}

func scanPaymentRows(rows pgx.Rows, p *Payment) error {
	return rows.Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate,
		&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount,
		&p.Competency, &p.Description, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
}

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING `+paymentCols,
		ownerID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) CreateIfAbsent(ctx context.Context, ownerID uuid.UUID, in CreatePaymentInput) (*Payment, bool, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`INSERT INTO payments (owner_id, lease_id, due_date, gross_amount, type, competency, description)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 ON CONFLICT (lease_id, competency, type) WHERE competency IS NOT NULL DO NOTHING
		 RETURNING `+paymentCols,
		ownerID, in.LeaseID, in.DueDate, in.GrossAmount, in.Type, in.Competency, in.Description,
	), &p)
	if err == nil {
		return &p, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: %w", err)
	}
	if in.Competency == nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent: insert silently skipped without competency")
	}
	var existing Payment
	err = scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+`
		 FROM payments
		 WHERE lease_id=$1 AND competency=$2 AND type=$3 AND owner_id=$4`,
		in.LeaseID, *in.Competency, in.Type, ownerID,
	), &existing)
	if err != nil {
		return nil, false, fmt.Errorf("payment.repo: create-if-absent lookup: %w", err)
	}
	return &existing, false, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	), &p)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("payment.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListByLease(ctx context.Context, leaseID, ownerID uuid.UUID) ([]Payment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE lease_id=$1 AND owner_id=$2 ORDER BY due_date`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by lease: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := scanPaymentRows(rows, &p); err != nil {
			return nil, fmt.Errorf("payment.repo: list scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payment.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) ListByOwner(ctx context.Context, ownerID uuid.UUID, statusFilter string) ([]Payment, error) {
	query := `SELECT ` + paymentCols + ` FROM payments WHERE owner_id=$1`
	args := []interface{}{ownerID}
	if statusFilter != "" {
		query += ` AND status=$2`
		args = append(args, statusFilter)
	}
	query += ` ORDER BY due_date DESC`

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by owner: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		if err := scanPaymentRows(rows, &p); err != nil {
			return nil, fmt.Errorf("payment.repo: list by owner scan: %w", err)
		}
		list = append(list, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("payment.repo: list by owner rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments SET paid_date=$1, status=$2, gross_amount=$3, updated_at=NOW()
		 WHERE id=$4 AND owner_id=$5
		 RETURNING `+paymentCols,
		in.PaidDate, in.Status, in.GrossAmount, id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: update: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) MarkPaid(ctx context.Context, id, ownerID uuid.UUID, paidDate time.Time,
	lateFee, interest, irrf, netAmount float64) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`UPDATE payments
		 SET paid_date=$1, status='PAID',
		     late_fee_amount=$2, interest_amount=$3, irrf_amount=$4, net_amount=$5,
		     updated_at=NOW()
		 WHERE id=$6 AND owner_id=$7
		 RETURNING `+paymentCols,
		paidDate, lateFee, interest, irrf, netAmount, id, ownerID,
	), &p)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: mark paid: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) UpdateChargeInfo(ctx context.Context, id, ownerID uuid.UUID, in UpdateChargeInfoInput) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE payments SET charge_id = $3, charge_method = $4, charge_qrcode = $5, charge_link = $6, charge_barcode = $7, updated_at = NOW()
		 WHERE id = $1 AND owner_id = $2`,
		id, ownerID, in.ChargeID, in.ChargeMethod, in.QRCode, in.Link, in.BarCode,
	)
	return err
}

func (r *pgRepository) UpdatePayoutInfo(ctx context.Context, id, ownerID uuid.UUID, payoutID, status string) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE payments SET payout_id = $3, payout_status = $4, updated_at = NOW()
		 WHERE id = $1 AND owner_id = $2`,
		id, ownerID, payoutID, status,
	)
	return err
}

func (r *pgRepository) GetByChargeID(ctx context.Context, chargeID string) (*Payment, error) {
	var p Payment
	err := scanPayment(r.db.Pool.QueryRow(ctx,
		`SELECT `+paymentCols+` FROM payments WHERE charge_id = $1`,
		chargeID,
	), &p)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("payment.repo: get by charge id: %w", err)
	}
	return &p, nil
}

package payment

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

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

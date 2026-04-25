package fiscal

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/inquilinotop/api/pkg/db"
)

type pgBracketsRepository struct{ db *db.DB }

func NewBracketsRepository(database *db.DB) BracketsRepository {
	return &pgBracketsRepository{db: database}
}

func (r *pgBracketsRepository) ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, valid_from, min_base, max_base, rate, deduction
		 FROM irrf_brackets
		 WHERE valid_from = (
		   SELECT MAX(valid_from) FROM irrf_brackets WHERE valid_from <= $1
		 )
		 ORDER BY min_base`, at,
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.brackets.repo: %w", err)
	}
	defer rows.Close()
	var list []IRRFBracket
	for rows.Next() {
		var b IRRFBracket
		if err := rows.Scan(&b.ID, &b.ValidFrom, &b.MinBase, &b.MaxBase, &b.Rate, &b.Deduction); err != nil {
			return nil, fmt.Errorf("fiscal.brackets.repo: scan: %w", err)
		}
		list = append(list, b)
	}
	return list, rows.Err()
}

type pgAggregateRepository struct{ db *db.DB }

func NewAggregateRepository(database *db.DB) AggregateRepository {
	return &pgAggregateRepository{db: database}
}

func (r *pgAggregateRepository) ListPaidPaymentsForYear(ctx context.Context, ownerID uuid.UUID, year int) ([]PaidPayment, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, lease_id, competency, gross_amount, late_fee_amount, interest_amount, irrf_amount,
		        COALESCE(net_amount, gross_amount + late_fee_amount + interest_amount - irrf_amount), type
		 FROM payments
		 WHERE owner_id=$1 AND status='PAID' AND competency IS NOT NULL
		   AND substring(competency FROM 1 FOR 4)=$2`,
		ownerID, fmt.Sprintf("%04d", year),
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.agg.repo: paid payments: %w", err)
	}
	defer rows.Close()
	var list []PaidPayment
	for rows.Next() {
		var p PaidPayment
		if err := rows.Scan(&p.PaymentID, &p.LeaseID, &p.Competency,
			&p.GrossAmount, &p.LateFeeAmount, &p.InterestAmount, &p.IRRFAmount, &p.NetAmount, &p.Type); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

func (r *pgAggregateRepository) ListTaxExpensesPaidInYear(ctx context.Context, ownerID uuid.UUID, year int) ([]TaxExpense, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT unit_id, amount
		 FROM expenses
		 WHERE owner_id=$1 AND category='TAX' AND is_active=true
		   AND EXTRACT(YEAR FROM due_date) = $2`,
		ownerID, year,
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.agg.repo: tax expenses: %w", err)
	}
	defer rows.Close()
	var list []TaxExpense
	for rows.Next() {
		var e TaxExpense
		if err := rows.Scan(&e.UnitID, &e.Amount); err != nil {
			return nil, err
		}
		e.PaidYear = year
		list = append(list, e)
	}
	return list, rows.Err()
}

func (r *pgAggregateRepository) ListOwnerLeases(ctx context.Context, ownerID uuid.UUID) ([]LeaseSummary, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT l.id, l.tenant_id, t.name, t.document, t.person_type,
		        u.id, u.label, p.address_line
		 FROM leases l
		 JOIN tenants t ON t.id = l.tenant_id
		 JOIN units u ON u.id = l.unit_id
		 JOIN properties p ON p.id = u.property_id
		 WHERE l.owner_id=$1`,
		ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("fiscal.agg.repo: owner leases: %w", err)
	}
	defer rows.Close()
	var list []LeaseSummary
	for rows.Next() {
		var s LeaseSummary
		if err := rows.Scan(&s.LeaseID, &s.TenantID, &s.TenantName, &s.TenantDocument, &s.TenantPersonType,
			&s.UnitID, &s.UnitLabel, &s.PropertyAddress); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *pgAggregateRepository) GetOwner(ctx context.Context, ownerID uuid.UUID) (*ReportParty, error) {
	var p ReportParty
	err := r.db.Pool.QueryRow(ctx,
		`SELECT email, NULL::text FROM users WHERE id=$1`, ownerID,
	).Scan(&p.Name, &p.Document)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrOwnerNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("fiscal.agg.repo: owner: %w", err)
	}
	return &p, nil
}

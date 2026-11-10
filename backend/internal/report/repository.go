package report

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(d *db.DB) Repository { return &pgRepository{db: d} }

const day = "2006-01-02"

// Aluguéis pagos: valor líquido (senão bruto), pela data de pagamento.
const paidRent = `FROM payments p
	WHERE p.organization_id=$1 AND p.is_active AND p.type='RENT' AND p.status='PAID'
	  AND p.paid_date BETWEEN $2::date AND $3::date`

// Despesas pagas: valor pago, pela data de pagamento.
const paidExpenses = `FROM expenses e
	WHERE e.organization_id=$1 AND e.is_active AND e.status='PAID'
	  AND e.paid_date BETWEEN $2::date AND $3::date`

func (r *pgRepository) monthly(ctx context.Context, q string, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error) {
	rows, err := r.db.Pool.Query(ctx, q, orgID, from.Format(day), to.Format(day))
	if err != nil {
		return nil, fmt.Errorf("report.repo: mensal: %w", err)
	}
	defer rows.Close()
	out := []MonthAmount{}
	for rows.Next() {
		var m MonthAmount
		if err := rows.Scan(&m.Month, &m.Total, &m.Count); err != nil {
			return nil, fmt.Errorf("report.repo: mensal: scan: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *pgRepository) MonthlyReceived(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error) {
	return r.monthly(ctx,
		`SELECT to_char(p.paid_date,'YYYY-MM'), COALESCE(SUM(COALESCE(p.net_amount, p.gross_amount)),0)::float8, COUNT(*)::int `+paidRent+`
		 GROUP BY 1 ORDER BY 1`, orgID, from, to)
}

func (r *pgRepository) MonthlyExpenses(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]MonthAmount, error) {
	return r.monthly(ctx,
		`SELECT to_char(e.paid_date,'YYYY-MM'), COALESCE(SUM(e.paid_amount),0)::float8, COUNT(*)::int `+paidExpenses+`
		 GROUP BY 1 ORDER BY 1`, orgID, from, to)
}

func (r *pgRepository) byUnit(ctx context.Context, q string, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error) {
	rows, err := r.db.Pool.Query(ctx, q, orgID, from.Format(day), to.Format(day))
	if err != nil {
		return nil, fmt.Errorf("report.repo: por unidade: %w", err)
	}
	defer rows.Close()
	out := []UnitAmount{}
	for rows.Next() {
		var u UnitAmount
		if err := rows.Scan(&u.UnitID, &u.Total); err != nil {
			return nil, fmt.Errorf("report.repo: por unidade: scan: %w", err)
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *pgRepository) UnitReceived(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error) {
	return r.byUnit(ctx,
		`SELECT l.unit_id, COALESCE(SUM(COALESCE(p.net_amount, p.gross_amount)),0)::float8
		 FROM payments p JOIN leases l ON l.id=p.lease_id AND l.organization_id=p.organization_id
		 WHERE p.organization_id=$1 AND p.is_active AND p.type='RENT' AND p.status='PAID'
		   AND p.paid_date BETWEEN $2::date AND $3::date
		 GROUP BY l.unit_id`, orgID, from, to)
}

func (r *pgRepository) UnitExpenses(ctx context.Context, orgID uuid.UUID, from, to time.Time) ([]UnitAmount, error) {
	return r.byUnit(ctx,
		`SELECT e.unit_id, COALESCE(SUM(e.paid_amount),0)::float8 `+paidExpenses+` GROUP BY e.unit_id`, orgID, from, to)
}

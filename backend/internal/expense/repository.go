package expense

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

type pgRepository struct{ db *db.DB }

const expenseCols = `id, organization_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount, is_active, created_at, updated_at`

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, userID, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO expenses (organization_id, owner_id, unit_id, description, amount, due_date, category)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, organization_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount, is_active, created_at, updated_at`,
		orgID, userID, in.UnitID, in.Description, in.Amount, in.DueDate, in.Category,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: create: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount, is_active, created_at, updated_at
		 FROM expenses WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("expense.repo: get by id: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) ListByUnit(ctx context.Context, unitID, orgID uuid.UUID) ([]Expense, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, organization_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount, is_active, created_at, updated_at
		 FROM expenses WHERE unit_id=$1 AND organization_id=$2 AND is_active=true ORDER BY due_date DESC`,
		unitID, orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: list by unit: %w", err)
	}
	defer rows.Close()
	var list []Expense
	for rows.Next() {
		var e Expense
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("expense.repo: list scan: %w", err)
		}
		list = append(list, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("expense.repo: list rows: %w", err)
	}
	return list, nil
}

// filterClause monta o WHERE comum de List e Summary. Parâmetros: $1 org, $2 hoje, depois os opcionais.
func filterClause(f ListFilter, today time.Time) (string, []interface{}) {
	// "$2::date IS NOT NULL" mantém $2 referenciado em qualquer filtro (o Postgres rejeita parâmetro sobrando).
	where := " WHERE organization_id=$1 AND is_active=true AND $2::date IS NOT NULL"
	args := []interface{}{nil, today}
	switch f.Status {
	case StatusPending:
		where += " AND status='PENDING' AND due_date >= $2"
	case StatusLate:
		where += " AND status='PENDING' AND due_date < $2"
	case StatusPaid:
		where += " AND status='PAID'"
	}
	if f.From != nil {
		args = append(args, *f.From)
		where += fmt.Sprintf(" AND due_date >= $%d", len(args))
	}
	if f.To != nil {
		args = append(args, *f.To)
		where += fmt.Sprintf(" AND due_date <= $%d", len(args))
	}
	if f.UnitID != nil {
		args = append(args, *f.UnitID)
		where += fmt.Sprintf(" AND unit_id = $%d", len(args))
	}
	return where, args
}

func (r *pgRepository) List(ctx context.Context, orgID uuid.UUID, f ListFilter, today time.Time) ([]Expense, error) {
	where, args := filterClause(f, today)
	args[0] = orgID
	rows, err := r.db.Pool.Query(ctx,
		`SELECT `+expenseCols+` FROM expenses`+where+` ORDER BY due_date DESC, created_at DESC`, args...)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: list: %w", err)
	}
	defer rows.Close()
	var list []Expense
	for rows.Next() {
		var e Expense
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("expense.repo: list scan: %w", err)
		}
		list = append(list, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("expense.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) MarkPaid(ctx context.Context, id, orgID uuid.UUID, paidDate time.Time, paidAmount float64) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE expenses SET status='PAID', paid_date=$1, paid_amount=$2, updated_at=NOW()
		 WHERE id=$3 AND organization_id=$4 AND is_active=true AND status='PENDING'
		 RETURNING `+expenseCols,
		paidDate, paidAmount, id, orgID,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAlreadyPaid
		}
		return nil, fmt.Errorf("expense.repo: mark paid: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) MarkUnpaid(ctx context.Context, id, orgID uuid.UUID) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE expenses SET status='PENDING', paid_date=NULL, paid_amount=NULL, updated_at=NOW()
		 WHERE id=$1 AND organization_id=$2 AND is_active=true AND status='PAID'
		 RETURNING `+expenseCols,
		id, orgID,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotPaid
		}
		return nil, fmt.Errorf("expense.repo: mark unpaid: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) Summary(ctx context.Context, orgID uuid.UUID, f ListFilter, today time.Time) (Summary, error) {
	f.Status = ""
	where, args := filterClause(f, today)
	args[0] = orgID
	var s Summary
	err := r.db.Pool.QueryRow(ctx,
		`SELECT
		   COUNT(*) FILTER (WHERE status='PENDING' AND due_date >= $2),
		   COALESCE(SUM(amount) FILTER (WHERE status='PENDING' AND due_date >= $2), 0),
		   COUNT(*) FILTER (WHERE status='PENDING' AND due_date < $2),
		   COALESCE(SUM(amount) FILTER (WHERE status='PENDING' AND due_date < $2), 0),
		   COUNT(*) FILTER (WHERE status='PAID'),
		   COALESCE(SUM(COALESCE(paid_amount, amount)) FILTER (WHERE status='PAID'), 0)
		 FROM expenses`+where, args...,
	).Scan(&s.ToPay.Count, &s.ToPay.Total, &s.Overdue.Count, &s.Overdue.Total, &s.Paid.Count, &s.Paid.Total)
	if err != nil {
		return s, fmt.Errorf("expense.repo: summary: %w", err)
	}
	s.ToPay.Total, s.Overdue.Total, s.Paid.Total = round2(s.ToPay.Total), round2(s.Overdue.Total), round2(s.Paid.Total)
	return s, nil
}

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE expenses SET description=$1, amount=$2, due_date=$3, category=$4, updated_at=NOW()
		 WHERE id=$5 AND organization_id=$6 AND is_active=true
		 RETURNING id, organization_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount, is_active, created_at, updated_at`,
		in.Description, in.Amount, in.DueDate, in.Category, id, orgID,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.Status, &e.PaidDate, &e.PaidAmount, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("expense.repo: update: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE expenses SET is_active=false, updated_at=NOW() WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	)
	if err != nil {
		return fmt.Errorf("expense.repo: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
}

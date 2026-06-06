package expense

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO expenses (organization_id, owner_id, unit_id, description, amount, due_date, category)
		 VALUES ($1,$1,$2,$3,$4,$5,$6)
		 RETURNING id, organization_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at`,
		orgID, in.UnitID, in.Description, in.Amount, in.DueDate, in.Category,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: create: %w", err)
	}
	return &e, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, orgID uuid.UUID) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at
		 FROM expenses WHERE id=$1 AND organization_id=$2 AND is_active=true`,
		id, orgID,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
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
		`SELECT id, organization_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at
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
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("expense.repo: list scan: %w", err)
		}
		list = append(list, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("expense.repo: list rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) ListByOwner(ctx context.Context, orgID uuid.UUID) ([]Expense, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, organization_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at
		 FROM expenses WHERE organization_id=$1 AND is_active=true ORDER BY due_date DESC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("expense.repo: list by owner: %w", err)
	}
	defer rows.Close()
	var list []Expense
	for rows.Next() {
		var e Expense
		if err := rows.Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("expense.repo: list by owner scan: %w", err)
		}
		list = append(list, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("expense.repo: list by owner rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) Update(ctx context.Context, id, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	var e Expense
	err := r.db.Pool.QueryRow(ctx,
		`UPDATE expenses SET description=$1, amount=$2, due_date=$3, category=$4, updated_at=NOW()
		 WHERE id=$5 AND organization_id=$6 AND is_active=true
		 RETURNING id, organization_id, unit_id, description, amount, due_date, category, is_active, created_at, updated_at`,
		in.Description, in.Amount, in.DueDate, in.Category, id, orgID,
	).Scan(&e.ID, &e.OrganizationID, &e.UnitID, &e.Description, &e.Amount, &e.DueDate, &e.Category, &e.IsActive, &e.CreatedAt, &e.UpdatedAt)
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

package payment

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct{ db *db.DB }

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ownerID uuid.UUID, in CreatePaymentInput) (*Payment, error) {
	var p Payment
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO payments (owner_id, lease_id, due_date, amount, type)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at`,
		ownerID, in.LeaseID, in.DueDate, in.Amount, in.Type,
	).Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: create: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) GetByID(id, ownerID uuid.UUID) (*Payment, error) {
	var p Payment
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at
		 FROM payments WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: get by id: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) ListByLease(leaseID, ownerID uuid.UUID) ([]Payment, error) {
	rows, err := r.db.Pool.Query(context.Background(),
		`SELECT id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at
		 FROM payments WHERE lease_id=$1 AND owner_id=$2 ORDER BY due_date`,
		leaseID, ownerID,
	)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: list by lease: %w", err)
	}
	defer rows.Close()
	var list []Payment
	for rows.Next() {
		var p Payment
		rows.Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
		list = append(list, p)
	}
	return list, nil
}

func (r *pgRepository) Update(id, ownerID uuid.UUID, in UpdatePaymentInput) (*Payment, error) {
	var p Payment
	err := r.db.Pool.QueryRow(context.Background(),
		`UPDATE payments SET paid_date=$1, status=$2, amount=$3, updated_at=NOW()
		 WHERE id=$4 AND owner_id=$5
		 RETURNING id, owner_id, lease_id, due_date, paid_date, amount, status, type, created_at, updated_at`,
		in.PaidDate, in.Status, in.Amount, id, ownerID,
	).Scan(&p.ID, &p.OwnerID, &p.LeaseID, &p.DueDate, &p.PaidDate, &p.Amount, &p.Status, &p.Type, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("payment.repo: update: %w", err)
	}
	return &p, nil
}

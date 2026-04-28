package support

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

type pgRepository struct {
	db *db.DB
}

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) Create(ctx context.Context, userID uuid.UUID, in CreateTicketInput) (*Ticket, error) {
	ticket := &Ticket{
		ID:         uuid.New(),
		UserID:     userID,
		Tipo:       in.Tipo,
		Assunto:    in.Assunto,
		Descricao:  in.Descricao,
		Status:     "open",
		CreatedAt:  time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}

	err := r.db.Pool.QueryRow(ctx, `
		INSERT INTO support_tickets (id, user_id, tipo, assunto, descricao, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, user_id, tipo, assunto, descricao, status, created_at, updated_at`,
		ticket.ID, ticket.UserID, ticket.Tipo, ticket.Assunto, ticket.Descricao,
		ticket.Status, ticket.CreatedAt, ticket.UpdatedAt,
	).Scan(&ticket.ID, &ticket.UserID, &ticket.Tipo, &ticket.Assunto,
		&ticket.Descricao, &ticket.Status, &ticket.CreatedAt, &ticket.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("support.repo: create: %w", err)
	}

	return ticket, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, userID uuid.UUID) (*Ticket, error) {
	ticket := &Ticket{}
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, user_id, tipo, assunto, descricao, status, created_at, updated_at
		FROM support_tickets
		WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&ticket.ID, &ticket.UserID, &ticket.Tipo, &ticket.Assunto,
		&ticket.Descricao, &ticket.Status, &ticket.CreatedAt, &ticket.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("support.repo: get by id: %w", err)
	}

	return ticket, nil
}

func (r *pgRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]Ticket, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, user_id, tipo, assunto, descricao, status, created_at, updated_at
		FROM support_tickets
		WHERE user_id = $1
		ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("support.repo: list by user: %w", err)
	}
	defer rows.Close()

	var tickets []Ticket
	for rows.Next() {
		var t Ticket
		if err := rows.Scan(&t.ID, &t.UserID, &t.Tipo, &t.Assunto,
			&t.Descricao, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("support.repo: scan: %w", err)
		}
		tickets = append(tickets, t)
	}

	return tickets, nil
}
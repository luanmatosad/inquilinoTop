package closing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type pgRepository struct{ db *db.DB }

func NewRepository(d *db.DB) Repository { return &pgRepository{db: d} }

const uniqueViolation = "23505"

func (r *pgRepository) GetActive(ctx context.Context, orgID uuid.UUID, month string) (*Closing, error) {
	var (
		c   Closing
		raw []byte
	)
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, organization_id, month, closed_at, closed_by, closed_by_name, snapshot
		   FROM month_closings WHERE organization_id=$1 AND month=$2 AND is_active`, orgID, month,
	).Scan(&c.ID, &c.OrganizationID, &c.Month, &c.ClosedAt, &c.ClosedBy, &c.ClosedByName, &raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierr.ErrNotFound
		}
		return nil, fmt.Errorf("closing.repo: get active: %w", err)
	}
	if err := json.Unmarshal(raw, &c.Snapshot); err != nil {
		return nil, fmt.Errorf("closing.repo: get active: snapshot: %w", err)
	}
	if c.Snapshot.Pending == nil {
		c.Snapshot.Pending = []Pending{}
	}
	c.Status = StatusClosed
	return &c, nil
}

func (r *pgRepository) Close(ctx context.Context, c Closing, e Event) error {
	raw, err := json.Marshal(c.Snapshot)
	if err != nil {
		return fmt.Errorf("closing.repo: close: snapshot: %w", err)
	}
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("closing.repo: close: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx,
		`INSERT INTO month_closings (id, organization_id, month, closed_by, closed_by_name, snapshot, closed_at)
		 VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()))`,
		c.ID, c.OrganizationID, c.Month, c.ClosedBy, c.ClosedByName, raw, c.ClosedAt,
	); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return ErrAlreadyClosed
		}
		return fmt.Errorf("closing.repo: close: insert: %w", err)
	}
	if err := insertEvent(ctx, tx, e); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("closing.repo: close: commit: %w", err)
	}
	return nil
}

func (r *pgRepository) Reopen(ctx context.Context, orgID uuid.UUID, month string, e Event) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("closing.repo: reopen: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var id uuid.UUID
	err = tx.QueryRow(ctx,
		`UPDATE month_closings SET is_active=false, reopened_at=NOW()
		  WHERE organization_id=$1 AND month=$2 AND is_active RETURNING id`, orgID, month,
	).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotClosed
		}
		return fmt.Errorf("closing.repo: reopen: update: %w", err)
	}
	e.ClosingID = id
	if err := insertEvent(ctx, tx, e); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("closing.repo: reopen: commit: %w", err)
	}
	return nil
}

// insertEvent usa o relógio do banco (NOW()) para a ordem do histórico ser a da gravação.
func insertEvent(ctx context.Context, tx pgx.Tx, e Event) error {
	if _, err := tx.Exec(ctx,
		`INSERT INTO month_closing_events (id, organization_id, month, closing_id, kind, actor_id, actor_name, reason)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		e.ID, e.OrganizationID, e.Month, e.ClosingID, e.Kind, e.ActorID, e.ActorName, e.Reason,
	); err != nil {
		return fmt.Errorf("closing.repo: insert event: %w", err)
	}
	return nil
}

func (r *pgRepository) Events(ctx context.Context, orgID uuid.UUID, month string) ([]Event, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, kind, actor_id, actor_name, reason, created_at
		   FROM month_closing_events WHERE organization_id=$1 AND month=$2 ORDER BY created_at, id`, orgID, month)
	if err != nil {
		return nil, fmt.Errorf("closing.repo: events: %w", err)
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.Kind, &e.ActorID, &e.ActorName, &e.Reason, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("closing.repo: events: scan: %w", err)
		}
		e.OrganizationID, e.Month = orgID, month
		out = append(out, e)
	}
	return out, rows.Err()
}

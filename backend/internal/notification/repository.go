package notification

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

func (r *pgRepository) Create(ctx context.Context, ownerID uuid.UUID, in CreateNotificationInput) (*Notification, error) {
	var notified Notification
	var createdAt time.Time
	var scheduledAt, sentAt *time.Time

	if in.ScheduledAt != nil {
		t, err := time.Parse(time.RFC3339, *in.ScheduledAt)
		if err != nil {
			return nil, fmt.Errorf("notification.repo: parse scheduled_at: %w", err)
		}
		scheduledAt = &t
	}

	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO notifications (owner_id, type, to_address, subject, body, status, scheduled_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, owner_id, type, to_address, subject, body, status, scheduled_at, sent_at, retry_count, created_at`,
		ownerID, in.Type, in.ToAddress, in.Subject, in.Body, StatusPending, scheduledAt,
	).Scan(&notified.ID, &notified.OwnerID, &notified.Type, &notified.ToAddress, &notified.Subject, &notified.Body, &notified.Status, &scheduledAt, &sentAt, &notified.RetryCount, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("notification.repo: create: %w", err)
	}

	notified.CreatedAt = createdAt.Format(time.RFC3339)
	if scheduledAt != nil {
		s := scheduledAt.Format(time.RFC3339)
		notified.ScheduledAt = &s
	}
	return &notified, nil
}

func (r *pgRepository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Notification, error) {
	n, err := scanNotification(r.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, type, to_address, subject, body, status, scheduled_at, sent_at, retry_count, created_at
		 FROM notifications WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	))
	if err != nil {
		return nil, fmt.Errorf("notification.repo: get by id: %w", err)
	}
	return &n, nil
}

// ListPending devolve os ids elegíveis para envio. Não reserva: a reserva é feita em ReserveAndSend.
func (r *pgRepository) ListPending(ctx context.Context, limit int) ([]uuid.UUID, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id
		 FROM notifications
		 WHERE owner_id IS NOT NULL AND status=$1 AND (scheduled_at IS NULL OR scheduled_at <= NOW())
		 ORDER BY created_at ASC
		 LIMIT $2`,
		StatusPending, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("notification.repo: list pending: %w", err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("notification.repo: list pending scan: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("notification.repo: list pending rows: %w", err)
	}
	return ids, nil
}

// ReserveAndSend reserva a notificação com FOR UPDATE SKIP LOCKED numa transação curta,
// executa send e grava o resultado (sent + sent_at, ou retry_count+1) antes do COMMIT.
// Retorna false sem erro quando a linha não está mais pendente ou está reservada por outra instância.
// Erro de send não é retornado: vira incremento de retry.
func (r *pgRepository) ReserveAndSend(ctx context.Context, id uuid.UUID, send func(Notification) error) (bool, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("notification.repo: reserve begin: %w", err)
	}
	defer tx.Rollback(ctx)

	n, err := scanNotification(tx.QueryRow(ctx,
		`SELECT id, owner_id, type, to_address, subject, body, status, scheduled_at, sent_at, retry_count, created_at
		 FROM notifications
		 WHERE id=$1 AND status=$2 AND (scheduled_at IS NULL OR scheduled_at <= NOW())
		 FOR UPDATE SKIP LOCKED`,
		id, StatusPending,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("notification.repo: reserve: %w", err)
	}

	if send(n) != nil {
		// Falha incrementa retry_count; ao atingir MaxRetries a notificação deixa de ser pendente.
		_, err = tx.Exec(ctx,
			`UPDATE notifications
			 SET retry_count = retry_count + 1,
			     status = CASE WHEN retry_count + 1 >= $2 THEN $3 ELSE status END
			 WHERE id=$1`,
			id, MaxRetries, StatusFailed,
		)
	} else {
		_, err = tx.Exec(ctx, `UPDATE notifications SET status=$1, sent_at=$2 WHERE id=$3`, StatusSent, time.Now(), id)
	}
	if err != nil {
		return false, fmt.Errorf("notification.repo: reserve update: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("notification.repo: reserve commit: %w", err)
	}
	return true, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanNotification(row rowScanner) (Notification, error) {
	var n Notification
	var createdAt time.Time
	var scheduledAt, sentAt *time.Time
	if err := row.Scan(&n.ID, &n.OwnerID, &n.Type, &n.ToAddress, &n.Subject, &n.Body, &n.Status, &scheduledAt, &sentAt, &n.RetryCount, &createdAt); err != nil {
		return Notification{}, err
	}
	n.CreatedAt = createdAt.Format(time.RFC3339)
	if scheduledAt != nil {
		s := scheduledAt.Format(time.RFC3339)
		n.ScheduledAt = &s
	}
	if sentAt != nil {
		s := sentAt.Format(time.RFC3339)
		n.SentAt = &s
	}
	return n, nil
}

func (r *pgRepository) ListByOwner(ctx context.Context, ownerID uuid.UUID, status string) ([]Notification, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, owner_id, type, to_address, subject, body, status, scheduled_at, sent_at, retry_count, created_at
		 FROM notifications 
		 WHERE owner_id=$1 AND status=$2
		 ORDER BY created_at DESC
		 LIMIT 100`,
		ownerID, status,
	)
	if err != nil {
		return nil, fmt.Errorf("notification.repo: list by owner: %w", err)
	}
	defer rows.Close()

	var list []Notification
	for rows.Next() {
		n, err := scanNotification(rows)
		if err != nil {
			return nil, fmt.Errorf("notification.repo: list by owner scan: %w", err)
		}
		list = append(list, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("notification.repo: list by owner rows: %w", err)
	}
	return list, nil
}

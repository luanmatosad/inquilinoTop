package notification

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
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
	var n Notification
	var createdAt, scheduledAt, sentAt time.Time

	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, owner_id, type, to_address, subject, body, status, scheduled_at, sent_at, retry_count, created_at
		 FROM notifications WHERE id=$1 AND owner_id=$2`,
		id, ownerID,
	).Scan(&n.ID, &n.OwnerID, &n.Type, &n.ToAddress, &n.Subject, &n.Body, &n.Status, &scheduledAt, &sentAt, &n.RetryCount, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("notification.repo: get by id: %w", err)
	}

	n.CreatedAt = createdAt.Format(time.RFC3339)
	if !scheduledAt.IsZero() {
		s := scheduledAt.Format(time.RFC3339)
		n.ScheduledAt = &s
	}
	if !sentAt.IsZero() {
		s := sentAt.Format(time.RFC3339)
		n.SentAt = &s
	}
	return &n, nil
}

func (r *pgRepository) ListPending(ctx context.Context, limit int) ([]Notification, error) {
	rows, err := r.db.Pool.Query(ctx,
		`SELECT id, owner_id, type, to_address, subject, body, status, scheduled_at, sent_at, retry_count, created_at
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

	var list []Notification
	for rows.Next() {
		var n Notification
		var createdAt, scheduledAt, sentAt time.Time
		if err := rows.Scan(&n.ID, &n.OwnerID, &n.Type, &n.ToAddress, &n.Subject, &n.Body, &n.Status, &scheduledAt, &sentAt, &n.RetryCount, &createdAt); err != nil {
			return nil, fmt.Errorf("notification.repo: list pending scan: %w", err)
		}
		n.CreatedAt = createdAt.Format(time.RFC3339)
		if !scheduledAt.IsZero() {
			s := scheduledAt.Format(time.RFC3339)
			n.ScheduledAt = &s
		}
		if !sentAt.IsZero() {
			s := sentAt.Format(time.RFC3339)
			n.SentAt = &s
		}
		list = append(list, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("notification.repo: list pending rows: %w", err)
	}
	return list, nil
}

func (r *pgRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status NotificationStatus, sentAt *time.Time) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE notifications SET status=$1, sent_at=$2 WHERE id=$3`,
		status, sentAt, id,
	)
	if err != nil {
		return fmt.Errorf("notification.repo: update status: %w", err)
	}
	return nil
}

func (r *pgRepository) IncrementRetry(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Pool.Exec(ctx,
		`UPDATE notifications SET retry_count = retry_count + 1 WHERE id=$1`,
		id,
	)
	if err != nil {
		return fmt.Errorf("notification.repo: increment retry: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apierr.ErrNotFound
	}
	return nil
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
		var n Notification
		var createdAt, scheduledAt, sentAt time.Time
		if err := rows.Scan(&n.ID, &n.OwnerID, &n.Type, &n.ToAddress, &n.Subject, &n.Body, &n.Status, &scheduledAt, &sentAt, &n.RetryCount, &createdAt); err != nil {
			return nil, fmt.Errorf("notification.repo: list by owner scan: %w", err)
		}
		n.CreatedAt = createdAt.Format(time.RFC3339)
		if !scheduledAt.IsZero() {
			s := scheduledAt.Format(time.RFC3339)
			n.ScheduledAt = &s
		}
		if !sentAt.IsZero() {
			s := sentAt.Format(time.RFC3339)
			n.SentAt = &s
		}
		list = append(list, n)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("notification.repo: list by owner rows: %w", err)
	}
	return list, nil
}
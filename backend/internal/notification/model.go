package notification

import (
	"context"

	"github.com/google/uuid"
)

type Notification struct {
	ID          uuid.UUID `json:"id"`
	OwnerID     uuid.UUID `json:"owner_id"`
	Type        string    `json:"type"`
	ToAddress   string    `json:"to_address"`
	Subject     string    `json:"subject"`
	Body        string    `json:"body"`
	Status      string    `json:"status"`
	ScheduledAt *string   `json:"scheduled_at,omitempty"`
	SentAt      *string   `json:"sent_at,omitempty"`
	RetryCount  int       `json:"retry_count"`
	CreatedAt   string    `json:"created_at"`
}

type CreateNotificationInput struct {
	Type        string  `json:"type" validate:"required,oneof=email sms push"`
	ToAddress   string  `json:"to_address" validate:"required,email"`
	Subject     string  `json:"subject" validate:"required,max=255"`
	Body        string  `json:"body" validate:"required"`
	ScheduledAt *string `json:"scheduled_at,omitempty"`
}

type NotificationType string

// MaxRetries é o número de falhas de envio após o qual a notificação vira failed.
const MaxRetries = 5

const (
	StatusPending NotificationStatus = "pending"
	StatusSent    NotificationStatus = "sent"
	StatusFailed  NotificationStatus = "failed"
)

type NotificationStatus string

type EmailSender interface {
	Send(ctx context.Context, to, subject, body string) error
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreateNotificationInput) (*Notification, error)
	GetByID(ctx context.Context, id, ownerID uuid.UUID) (*Notification, error)
	ListPending(ctx context.Context, limit int) ([]uuid.UUID, error)
	ListByOwner(ctx context.Context, ownerID uuid.UUID, status string) ([]Notification, error)
	ReserveAndSend(ctx context.Context, id uuid.UUID, send func(Notification) error) (bool, error)
}

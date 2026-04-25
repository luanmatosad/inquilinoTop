package audit

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type AuditLog struct {
	ID          uuid.UUID   `json:"id"`
	OwnerID     uuid.UUID   `json:"owner_id"`
	UserID      *uuid.UUID `json:"user_id,omitempty"`
	EventType   string     `json:"event_type"`
	EntityType  *string    `json:"entity_type,omitempty"`
	EntityID    *uuid.UUID `json:"entity_id,omitempty"`
	IPAddress   *string    `json:"ip_address,omitempty"`
	UserAgent   *string    `json:"user_agent,omitempty"`
	Details     interface{} `json:"details,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type EventType string

const (
	EventLogin       EventType = "LOGIN"
	EventLogout     EventType = "LOGOUT"
	EventFailedLogin EventType = "FAILED_LOGIN"
	EventCreate     EventType = "CREATE"
	EventUpdate     EventType = "UPDATE"
	EventDelete     EventType = "DELETE"
	EventPermissionDenied EventType = "PERMISSION_DENIED"
)

type CreateInput struct {
	UserID     *uuid.UUID
	EventType  string
	EntityType *string
	EntityID   *uuid.UUID
	IPAddress  *string
	UserAgent  *string
	Details    interface{}
}

type Repository interface {
	Create(ctx context.Context, ownerID uuid.UUID, in CreateInput) (*AuditLog, error)
	List(ctx context.Context, ownerID uuid.UUID, from, to *time.Time, eventType *string) ([]AuditLog, error)
}
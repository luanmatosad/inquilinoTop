package support

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Ticket struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	Tipo        string   `json:"tipo"`
	Assunto     string   `json:"assunto"`
	Descricao  string   `json:"descricao"`
	Status     string   `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateTicketInput struct {
	Tipo       string `json:"tipo" validate:"required,oneof=BUG FEATURE DOUBT PAYMENT"`
	Assunto    string `json:"assunto" validate:"required,max=200"`
	Descricao string `json:"descricao" validate:"required,max=5000"`
}

type Repository interface {
	Create(ctx context.Context, userID uuid.UUID, in CreateTicketInput) (*Ticket, error)
	GetByID(ctx context.Context, id, userID uuid.UUID) (*Ticket, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Ticket, error)
}
package fiscal

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type IRRFBracket struct {
	ID         uuid.UUID `json:"id"`
	ValidFrom  time.Time `json:"valid_from"`
	MinBase    float64   `json:"min_base"`
	MaxBase    *float64  `json:"max_base,omitempty"`
	Rate       float64   `json:"rate"`
	Deduction  float64   `json:"deduction"`
}

type BracketsRepository interface {
	ActiveBrackets(ctx context.Context, at time.Time) ([]IRRFBracket, error)
}

type IRRFTable interface {
	Calculate(ctx context.Context, base float64, at time.Time) (float64, error)
}

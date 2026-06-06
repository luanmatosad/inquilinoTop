package identity

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/organization"
)

type OrgMembership struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	UserID         uuid.UUID  `json:"user_id"`
	Role           string     `json:"role"`
	BranchID       *uuid.UUID `json:"branch_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type OrgMembershipRepository interface {
	GetByUserID(ctx context.Context, userID uuid.UUID) (*OrgMembership, error)
}

type OrgMemberAdapter struct {
	Repo organization.Repository
}

func (a *OrgMemberAdapter) GetByUserID(ctx context.Context, userID uuid.UUID) (*OrgMembership, error) {
	m, err := a.Repo.GetMembershipByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, nil
	}
	return &OrgMembership{
		ID:             m.ID,
		OrganizationID: m.OrganizationID,
		UserID:         m.UserID,
		Role:           string(m.Role),
		BranchID:       m.BranchID,
		CreatedAt:      m.CreatedAt,
	}, nil
}
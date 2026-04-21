package payment

import (
	"context"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/property"
)

type UnitReaderAdapter struct {
	Repo property.Repository
}

func (a *UnitReaderAdapter) GetByID(ctx context.Context, id, ownerID uuid.UUID) (*UnitSummary, error) {
	u, err := a.Repo.GetUnit(ctx, id)
	if err != nil {
		return nil, err
	}
	p, err := a.Repo.GetByID(ctx, u.PropertyID, ownerID)
	if err != nil {
		return nil, err
	}
	label := u.Label
	addr := ""
	if p.AddressLine != nil {
		addr = *p.AddressLine
	}
	return &UnitSummary{ID: u.ID, Label: &label, PropertyAddress: &addr}, nil
}

type OwnerReaderAdapter struct {
	Repo identity.Repository
}

func (a *OwnerReaderAdapter) GetByID(ctx context.Context, id uuid.UUID) (*OwnerSummary, error) {
	u, err := a.Repo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &OwnerSummary{ID: u.ID, Name: u.Email}, nil
}

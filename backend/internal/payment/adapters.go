package payment

import (
	"context"
	"github.com/inquilinotop/api/internal/settings"
	"strings"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/property"
)

type UnitReaderAdapter struct {
	Repo property.Repository
}

func (a *UnitReaderAdapter) GetByID(ctx context.Context, id, orgID uuid.UUID) (*UnitSummary, error) {
	u, err := a.Repo.GetUnit(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	p, err := a.Repo.GetByID(ctx, u.PropertyID, orgID)
	if err != nil {
		return nil, err
	}
	label := u.Label
	addr := ""
	if p.AddressLine != nil {
		addr = *p.AddressLine
	}
	return &UnitSummary{ID: u.ID, Label: &label, PropertyAddress: &addr, PropertyCity: p.City}, nil
}

type OwnerReaderAdapter struct {
	Repo identity.Repository
}

func (a *OwnerReaderAdapter) GetByID(ctx context.Context, id uuid.UUID) (*OwnerSummary, error) {
	u, err := a.Repo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// O nome do perfil (quando preenchido) vale mais que o e-mail; é o que aparece no recibo e no Pix.
	summary := &OwnerSummary{ID: u.ID, Name: u.Email}
	if prof, err := a.Repo.GetProfile(ctx, id); err == nil && prof != nil {
		if prof.FullName != nil && strings.TrimSpace(*prof.FullName) != "" {
			summary.Name = strings.TrimSpace(*prof.FullName)
		}
		if prof.Document != nil && strings.TrimSpace(*prof.Document) != "" {
			summary.Document = prof.Document
		}
	}
	return summary, nil
}

// PixAccountAdapter liga a escolha da conta Pix (módulo settings) à cobrança sem `payment` conhecer as tabelas.
type PixAccountAdapter struct {
	Svc interface {
		ResolvePixAccount(ctx context.Context, orgID, unitID uuid.UUID) (*settings.PixAccount, error)
	}
}

func (a *PixAccountAdapter) ResolvePixAccount(ctx context.Context, orgID, unitID uuid.UUID) (*PixAccount, error) {
	acct, err := a.Svc.ResolvePixAccount(ctx, orgID, unitID)
	if err != nil || acct == nil {
		return nil, err
	}
	return &PixAccount{Key: acct.Key, ReceiverName: acct.ReceiverName, City: acct.City}, nil
}

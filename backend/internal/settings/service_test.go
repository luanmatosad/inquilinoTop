package settings_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var org = uuid.New()

type mockRepo struct {
	rows map[uuid.UUID]settings.FinancialRules
	// Pix
	pixDefault map[uuid.UUID]*settings.PixDefault
	unitPix    map[uuid.UUID]*settings.UnitPix // por unidade (conta ativa)
	unitOrg    map[uuid.UUID]uuid.UUID         // unidade -> organização dona
	confirmers map[uuid.UUID]uuid.UUID         // unidade -> quem confirmou
	reminders  map[uuid.UUID][]settings.Reminder
}

func newMock() *mockRepo {
	return &mockRepo{
		rows:       map[uuid.UUID]settings.FinancialRules{},
		pixDefault: map[uuid.UUID]*settings.PixDefault{},
		unitPix:    map[uuid.UUID]*settings.UnitPix{},
		unitOrg:    map[uuid.UUID]uuid.UUID{},
		confirmers: map[uuid.UUID]uuid.UUID{},
		reminders:  map[uuid.UUID][]settings.Reminder{},
	}
}

func (m *mockRepo) ListReminders(_ context.Context, orgID uuid.UUID) ([]settings.Reminder, error) {
	return m.reminders[orgID], nil
}

func (m *mockRepo) ReplaceReminders(_ context.Context, orgID, _ uuid.UUID, list []settings.Reminder) error {
	m.reminders[orgID] = list
	return nil
}

func (m *mockRepo) GetPixDefault(_ context.Context, orgID uuid.UUID) (*settings.PixDefault, error) {
	return m.pixDefault[orgID], nil
}

func (m *mockRepo) SavePixDefault(_ context.Context, orgID, _ uuid.UUID, a settings.PixAccount) (*settings.PixDefault, error) {
	d := &settings.PixDefault{Configured: true, KeyType: a.KeyType, Key: a.Key, ReceiverName: a.ReceiverName, City: a.City}
	m.pixDefault[orgID] = d
	return d, nil
}

func (m *mockRepo) GetUnitPix(_ context.Context, orgID, unitID uuid.UUID) (*settings.UnitPix, error) {
	if m.unitOrg[unitID] != orgID {
		return nil, nil
	}
	return m.unitPix[unitID], nil
}

func (m *mockRepo) ListUnitPix(_ context.Context, orgID uuid.UUID) ([]settings.UnitPix, error) {
	var out []settings.UnitPix
	for unit, u := range m.unitPix {
		if m.unitOrg[unit] == orgID {
			out = append(out, *u)
		}
	}
	return out, nil
}

func (m *mockRepo) SaveUnitPix(_ context.Context, orgID, unitID, userID uuid.UUID, a settings.PixAccount) (*settings.UnitPix, error) {
	if m.unitOrg[unitID] != orgID {
		return nil, apierr.ErrNotFound
	}
	u := &settings.UnitPix{UnitID: unitID, KeyType: a.KeyType, Key: a.Key, ReceiverName: a.ReceiverName, ConfirmedAt: time.Now()}
	m.unitPix[unitID] = u
	m.confirmers[unitID] = userID
	return u, nil
}

func (m *mockRepo) RemoveUnitPix(_ context.Context, orgID, unitID uuid.UUID) error {
	if m.unitOrg[unitID] != orgID || m.unitPix[unitID] == nil {
		return apierr.ErrNotFound
	}
	delete(m.unitPix, unitID)
	return nil
}

func (m *mockRepo) GetFinancialRules(_ context.Context, orgID uuid.UUID) (*settings.FinancialRules, error) {
	r, ok := m.rows[orgID]
	if !ok {
		return nil, nil
	}
	return &r, nil
}

func (m *mockRepo) SaveFinancialRules(_ context.Context, orgID, _ uuid.UUID, r settings.FinancialRules) (*settings.FinancialRules, error) {
	m.rows[orgID] = r
	return &r, nil
}

func TestService_Get_SemLinhaDevolveOsPadroes(t *testing.T) {
	r, err := settings.NewService(newMock()).GetFinancialRules(context.Background(), org)
	require.NoError(t, err)
	assert.Equal(t, settings.FinancialRules{LateFeePercent: 2, MonthlyInterestPercent: 1, DefaultAdjustmentIndex: "IGP-M", ReadjustNoticeDays: 60}, *r)
}

func TestService_Save_GravaEDevolve(t *testing.T) {
	svc := settings.NewService(newMock())
	in := settings.FinancialRules{LateFeePercent: 2.5, MonthlyInterestPercent: 1, DefaultAdjustmentIndex: "IPCA", ReadjustNoticeDays: 45}
	saved, err := svc.SaveFinancialRules(context.Background(), org, uuid.New(), in)
	require.NoError(t, err)
	assert.Equal(t, in, *saved)
	got, _ := svc.GetFinancialRules(context.Background(), org)
	assert.Equal(t, in, *got)
}

func TestService_Save_Validacao(t *testing.T) {
	ok := settings.FinancialRules{LateFeePercent: 2, MonthlyInterestPercent: 1, DefaultAdjustmentIndex: "IGP-M", ReadjustNoticeDays: 60}
	cases := map[string]func(r *settings.FinancialRules){
		"multa negativa":      func(r *settings.FinancialRules) { r.LateFeePercent = -0.1 },
		"multa acima de 10":   func(r *settings.FinancialRules) { r.LateFeePercent = 10.01 },
		"juros acima de 5":    func(r *settings.FinancialRules) { r.MonthlyInterestPercent = 5.01 },
		"juros negativo":      func(r *settings.FinancialRules) { r.MonthlyInterestPercent = -1 },
		"índice desconhecido": func(r *settings.FinancialRules) { r.DefaultAdjustmentIndex = "SELIC" },
		"índice vazio":        func(r *settings.FinancialRules) { r.DefaultAdjustmentIndex = "" },
		"aviso zero":          func(r *settings.FinancialRules) { r.ReadjustNoticeDays = 0 },
		"aviso acima de 180":  func(r *settings.FinancialRules) { r.ReadjustNoticeDays = 181 },
	}
	for name, mutate := range cases {
		repo := newMock()
		in := ok
		mutate(&in)
		_, err := settings.NewService(repo).SaveFinancialRules(context.Background(), org, uuid.New(), in)
		assert.ErrorIs(t, err, settings.ErrInvalidRules, name)
		assert.Empty(t, repo.rows, "%s: nada é gravado", name)
	}
}

func TestService_Save_LimitesValem(t *testing.T) {
	for _, in := range []settings.FinancialRules{
		{LateFeePercent: 0, MonthlyInterestPercent: 0, DefaultAdjustmentIndex: "IGP-M", ReadjustNoticeDays: 1},
		{LateFeePercent: 10, MonthlyInterestPercent: 5, DefaultAdjustmentIndex: "IPCA", ReadjustNoticeDays: 180},
	} {
		_, err := settings.NewService(newMock()).SaveFinancialRules(context.Background(), org, uuid.New(), in)
		assert.NoError(t, err)
	}
}

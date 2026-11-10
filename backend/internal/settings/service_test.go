package settings_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var org = uuid.New()

type mockRepo struct {
	rows map[uuid.UUID]settings.FinancialRules
}

func newMock() *mockRepo { return &mockRepo{rows: map[uuid.UUID]settings.FinancialRules{}} }

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

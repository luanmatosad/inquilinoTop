package report_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/report"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	org    = uuid.New()
	loc, _ = time.LoadLocation("America/Sao_Paulo")
)

type mockRepo struct {
	received []report.MonthAmount
	expenses []report.MonthAmount
	unitRecv []report.UnitAmount
	unitExp  []report.UnitAmount
	from, to time.Time
	calls    int
}

func (m *mockRepo) MonthlyReceived(_ context.Context, _ uuid.UUID, from, to time.Time) ([]report.MonthAmount, error) {
	m.calls++
	m.from, m.to = from, to
	return m.received, nil
}
func (m *mockRepo) MonthlyExpenses(_ context.Context, _ uuid.UUID, _, _ time.Time) ([]report.MonthAmount, error) {
	return m.expenses, nil
}
func (m *mockRepo) UnitReceived(_ context.Context, _ uuid.UUID, _, _ time.Time) ([]report.UnitAmount, error) {
	return m.unitRecv, nil
}
func (m *mockRepo) UnitExpenses(_ context.Context, _ uuid.UUID, _, _ time.Time) ([]report.UnitAmount, error) {
	return m.unitExp, nil
}

func svcAt(repo *mockRepo, y int, mo time.Month, d int) *report.Service {
	return report.NewService(repo).WithClock(func() time.Time { return time.Date(y, mo, d, 12, 0, 0, 0, loc) })
}

func TestService_Overview_AnoCorrenteEmNovembro(t *testing.T) {
	repo := &mockRepo{
		received: []report.MonthAmount{{Month: "2026-01", Total: 1850, Count: 1}, {Month: "2026-10", Total: 8300, Count: 5}},
		expenses: []report.MonthAmount{{Month: "2026-10", Total: 1100, Count: 2}},
	}
	o, err := svcAt(repo, 2026, time.November, 8).Overview(context.Background(), org, 2026)
	require.NoError(t, err)
	assert.Equal(t, 10, o.ThroughMonth)
	require.Len(t, o.Months, 10, "janeiro a outubro, mesmo zerados")
	assert.Equal(t, "2026-01", o.Months[0].Month)
	assert.Equal(t, 1850.0, o.Months[0].Received)
	assert.Equal(t, 0.0, o.Months[1].Received)
	assert.Equal(t, 1100.0, o.Months[9].Expenses)
	assert.Equal(t, 10150.0, o.Totals.Received)
	assert.Equal(t, 1100.0, o.Totals.Expenses)
	assert.Equal(t, 9050.0, o.Totals.Result)
	assert.Equal(t, 6, o.Totals.PaymentsCount)
	assert.Equal(t, "2026-01-01", repo.from.Format("2006-01-02"))
	assert.Equal(t, "2026-10-31", repo.to.Format("2006-01-02"))
}

func TestService_Overview_AnoPassadoTemDozeMeses(t *testing.T) {
	o, err := svcAt(&mockRepo{}, 2026, time.November, 8).Overview(context.Background(), org, 2025)
	require.NoError(t, err)
	assert.Equal(t, 12, o.ThroughMonth)
	assert.Len(t, o.Months, 12)
}

func TestService_Overview_JaneiroSemMesCompleto(t *testing.T) {
	repo := &mockRepo{}
	o, err := svcAt(repo, 2026, time.January, 15).Overview(context.Background(), org, 2026)
	require.NoError(t, err)
	assert.Equal(t, 0, o.ThroughMonth)
	assert.Empty(t, o.Months)
	assert.NotNil(t, o.Months, "lista nunca nil")
	assert.Equal(t, 0.0, o.Totals.Result)
	assert.Equal(t, 0, repo.calls, "nem consulta o banco")
}

func TestService_Overview_AnoInvalido(t *testing.T) {
	s := svcAt(&mockRepo{}, 2026, time.November, 8)
	for _, y := range []int{2027, 1999, 0} {
		_, err := s.Overview(context.Background(), org, y)
		assert.ErrorIs(t, err, report.ErrInvalidYear, y)
	}
}

func TestService_ByProperty_JuntaEOrdenaPorResultado(t *testing.T) {
	a, b, c := uuid.New(), uuid.New(), uuid.New()
	repo := &mockRepo{
		unitRecv: []report.UnitAmount{{UnitID: a, Total: 1850}, {UnitID: b, Total: 1000}},
		unitExp:  []report.UnitAmount{{UnitID: a, Total: 300}, {UnitID: c, Total: 50}},
	}
	r, err := svcAt(repo, 2026, time.November, 8).ByProperty(context.Background(), org, 2026)
	require.NoError(t, err)
	require.Len(t, r.Rows, 3)
	assert.Equal(t, a, r.Rows[0].UnitID)
	assert.Equal(t, 1550.0, r.Rows[0].Result)
	assert.Equal(t, b, r.Rows[1].UnitID)
	assert.Equal(t, 1000.0, r.Rows[1].Result)
	assert.Equal(t, c, r.Rows[2].UnitID)
	assert.Equal(t, -50.0, r.Rows[2].Result)
	assert.Equal(t, 2850.0, r.Totals.Received)
	assert.Equal(t, 350.0, r.Totals.Expenses)
	assert.Equal(t, 2500.0, r.Totals.Result)
}

func TestService_ByProperty_Janeiro(t *testing.T) {
	r, err := svcAt(&mockRepo{}, 2026, time.January, 15).ByProperty(context.Background(), org, 2026)
	require.NoError(t, err)
	assert.NotNil(t, r.Rows)
	assert.Empty(t, r.Rows)
}

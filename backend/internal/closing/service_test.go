package closing_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/closing"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	org    = uuid.New()
	user   = uuid.New()
	loc, _ = time.LoadLocation("America/Sao_Paulo")
	// "Hoje" fixo: 07/11/2026, então outubro já encerrou e novembro não.
	now = time.Date(2026, 11, 7, 12, 0, 0, 0, loc)
)

type mockSource struct {
	facts []closing.PaymentFact
	from  time.Time
	to    time.Time
	err   error
}

func (m *mockSource) RentOfMonth(_ context.Context, _ uuid.UUID, from, to time.Time) ([]closing.PaymentFact, error) {
	m.from, m.to = from, to
	return m.facts, m.err
}

type mockNames struct{}

func (mockNames) Name(_ context.Context, _ uuid.UUID) string { return "Luan Matos" }

type mockRepo struct {
	active map[string]*closing.Closing // org|month
	events []closing.Event
}

func newMockRepo() *mockRepo { return &mockRepo{active: map[string]*closing.Closing{}} }

func key(o uuid.UUID, m string) string { return o.String() + "|" + m }

func (r *mockRepo) GetActive(_ context.Context, o uuid.UUID, m string) (*closing.Closing, error) {
	c, ok := r.active[key(o, m)]
	if !ok {
		return nil, apierr.ErrNotFound
	}
	return c, nil
}

func (r *mockRepo) Close(_ context.Context, c closing.Closing, e closing.Event) error {
	if _, ok := r.active[key(c.OrganizationID, c.Month)]; ok {
		return closing.ErrAlreadyClosed
	}
	r.active[key(c.OrganizationID, c.Month)] = &c
	r.events = append(r.events, e)
	return nil
}

func (r *mockRepo) Reopen(_ context.Context, o uuid.UUID, m string, e closing.Event) error {
	if _, ok := r.active[key(o, m)]; !ok {
		return closing.ErrNotClosed
	}
	delete(r.active, key(o, m))
	r.events = append(r.events, e)
	return nil
}

func (r *mockRepo) Events(_ context.Context, o uuid.UUID, m string) ([]closing.Event, error) {
	var out []closing.Event
	for _, e := range r.events {
		if e.OrganizationID == o && e.Month == m {
			out = append(out, e)
		}
	}
	return out, nil
}

func newSvc(facts []closing.PaymentFact) (*closing.Service, *mockRepo, *mockSource) {
	repo := newMockRepo()
	src := &mockSource{facts: facts}
	return closing.NewService(repo, src, mockNames{}).WithClock(func() time.Time { return now }), repo, src
}

func october() []closing.PaymentFact {
	return []closing.PaymentFact{
		{ID: uuid.New(), Tenant: "Marina", Gross: 1850, Paid: true, HasReceipt: true},
		{ID: uuid.New(), Tenant: "Carlos", Gross: 2000, Paid: true, HasReceipt: true},
		{ID: uuid.New(), Tenant: "Ana", Gross: 1500, Paid: true, HasReceipt: false},
		{ID: uuid.New(), Tenant: "Pedro", Gross: 1400, Paid: true, HasReceipt: true},
		{ID: uuid.New(), Tenant: "Bruno Lima", Gross: 1550, Paid: false},
	}
}

func TestService_Snapshot_Numeros(t *testing.T) {
	svc, _, src := newSvc(october())
	c, err := svc.Get(context.Background(), org, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, "OPEN", c.Status)
	s := c.Snapshot
	assert.Equal(t, closing.Bucket{Count: 5, Total: 8300}, s.Forecast)
	assert.Equal(t, closing.Bucket{Count: 4, Total: 6750}, s.Received)
	assert.Equal(t, closing.Bucket{Count: 1, Total: 1550}, s.Overdue)
	assert.Equal(t, 3, s.ReceiptsIssued)
	require.Len(t, s.Pending, 1)
	assert.Equal(t, "Bruno Lima", s.Pending[0].Tenant)
	assert.False(t, s.Pending[0].Awaiting)
	assert.Equal(t, "2026-10-01", src.from.Format("2006-01-02"))
	assert.Equal(t, "2026-10-31", src.to.Format("2006-01-02"))
}

func TestService_Snapshot_AvisoPendenteContaComoPendencia(t *testing.T) {
	facts := []closing.PaymentFact{{ID: uuid.New(), Tenant: "Ana", Gross: 1000, Awaiting: true}}
	svc, _, _ := newSvc(facts)
	c, err := svc.Get(context.Background(), org, "2026-10")
	require.NoError(t, err)
	require.Len(t, c.Snapshot.Pending, 1)
	assert.True(t, c.Snapshot.Pending[0].Awaiting)
	assert.Equal(t, 1, c.Snapshot.Overdue.Count)
}

func TestService_Close_MesInvalido(t *testing.T) {
	svc, _, _ := newSvc(nil)
	for _, m := range []string{"", "2026-13", "26-10", "2026/10"} {
		_, err := svc.Close(context.Background(), org, user, m)
		assert.ErrorIs(t, err, closing.ErrInvalidMonth, m)
	}
}

func TestService_Close_MesCorrenteEFuturo(t *testing.T) {
	svc, _, _ := newSvc(nil)
	for _, m := range []string{"2026-11", "2026-12", "2027-01"} {
		_, err := svc.Close(context.Background(), org, user, m)
		assert.ErrorIs(t, err, closing.ErrMonthNotEnded, m)
	}
}

func TestService_Close_GravaRetratoEHistorico(t *testing.T) {
	svc, repo, _ := newSvc(october())
	c, err := svc.Close(context.Background(), org, user, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, "CLOSED", c.Status)
	assert.Equal(t, "Luan Matos", c.ClosedByName)
	assert.Equal(t, 1, len(c.Snapshot.Pending))
	require.Len(t, c.Events, 1)
	assert.Equal(t, "CLOSED", c.Events[0].Kind)
	assert.Len(t, repo.events, 1)
}

func TestService_Close_JaFechado(t *testing.T) {
	svc, _, _ := newSvc(october())
	_, err := svc.Close(context.Background(), org, user, "2026-10")
	require.NoError(t, err)
	_, err = svc.Close(context.Background(), org, user, "2026-10")
	assert.ErrorIs(t, err, closing.ErrAlreadyClosed)
}

func TestService_Get_FechadoMantemRetrato(t *testing.T) {
	svc, _, src := newSvc(october())
	_, err := svc.Close(context.Background(), org, user, "2026-10")
	require.NoError(t, err)
	// Pagamento tardio: o retrato gravado não muda.
	src.facts[4].Paid = true
	c, err := svc.Get(context.Background(), org, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, "CLOSED", c.Status)
	assert.Equal(t, 1, c.Snapshot.Overdue.Count)
}

func TestService_Reopen(t *testing.T) {
	svc, _, _ := newSvc(october())
	_, err := svc.Reopen(context.Background(), org, user, "2026-10", "corrigir baixa")
	assert.ErrorIs(t, err, closing.ErrNotClosed)

	_, err = svc.Close(context.Background(), org, user, "2026-10")
	require.NoError(t, err)

	_, err = svc.Reopen(context.Background(), org, user, "2026-10", "  ")
	assert.ErrorIs(t, err, closing.ErrInvalidReason)

	c, err := svc.Reopen(context.Background(), org, user, "2026-10", "corrigir baixa")
	require.NoError(t, err)
	assert.Equal(t, "OPEN", c.Status)
	require.Len(t, c.Events, 2)
	assert.Equal(t, "REOPENED", c.Events[1].Kind)
	require.NotNil(t, c.Events[1].Reason)
	assert.Equal(t, "corrigir baixa", *c.Events[1].Reason)

	// Fechar de novo gera novo retrato.
	_, err = svc.Close(context.Background(), org, user, "2026-10")
	require.NoError(t, err)
}

func TestService_Isolamento(t *testing.T) {
	svc, _, _ := newSvc(october())
	_, err := svc.Close(context.Background(), org, user, "2026-10")
	require.NoError(t, err)
	other, err := svc.Get(context.Background(), uuid.New(), "2026-10")
	require.NoError(t, err)
	assert.Equal(t, "OPEN", other.Status)
	assert.Empty(t, other.Events)
}

func TestService_FalhaNaFonte(t *testing.T) {
	svc, _, src := newSvc(nil)
	src.err = errors.New("boom")
	_, err := svc.Get(context.Background(), org, "2026-10")
	assert.Error(t, err)
}

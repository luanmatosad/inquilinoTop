package dashboard

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var brt = time.FixedZone("BRT", -3*60*60)

type mockRepo struct {
	metrics *Metrics
	err     error
	gotOrg  uuid.UUID
	gotNow  time.Time
}

func (m *mockRepo) GetMetrics(_ context.Context, orgID uuid.UUID, now time.Time) (*Metrics, error) {
	m.gotOrg = orgID
	m.gotNow = now
	return m.metrics, m.err
}

func TestService_GetMetrics_RepassaOrganizacao(t *testing.T) {
	repo := &mockRepo{metrics: &Metrics{TotalProperties: 2}}
	svc := NewService(repo, brt)
	org := uuid.New()

	got, err := svc.GetMetrics(context.Background(), org)

	require.NoError(t, err)
	assert.Equal(t, org, repo.gotOrg)
	assert.Equal(t, 2, got.TotalProperties)
	assert.False(t, repo.gotNow.IsZero())
}

func TestService_GetMetrics_ListasNuncaNil(t *testing.T) {
	svc := NewService(&mockRepo{metrics: &Metrics{}}, brt)

	got, err := svc.GetMetrics(context.Background(), uuid.New())

	require.NoError(t, err)
	assert.NotNil(t, got.RecentPayments)
	assert.NotNil(t, got.ExpiringLeases)
	assert.Empty(t, got.RecentPayments)
	assert.Empty(t, got.ExpiringLeases)
}

func TestService_GetMetrics_ErroDoRepo(t *testing.T) {
	boom := errors.New("boom")
	svc := NewService(&mockRepo{err: boom}, brt)

	got, err := svc.GetMetrics(context.Background(), uuid.New())

	assert.Nil(t, got)
	assert.ErrorIs(t, err, boom)
}

func TestService_VacancyRate_Calculo(t *testing.T) {
	assert.Equal(t, 30.0, VacancyRate(10, 7))
	assert.Equal(t, 0.0, VacancyRate(0, 0))
	assert.Equal(t, 0.0, VacancyRate(5, 5))
	assert.Equal(t, 100.0, VacancyRate(4, 0))
}

func TestService_VacancyRate_Arredonda2Casas(t *testing.T) {
	assert.Equal(t, 33.33, VacancyRate(3, 2))
	assert.Equal(t, 66.67, VacancyRate(3, 1))
}

func TestService_GetMetrics_UsaFusoConfigurado(t *testing.T) {
	repo := &mockRepo{metrics: &Metrics{}}
	svc := NewService(repo, brt)
	// 2026-06-01 02:30 UTC == 2026-05-31 23:30 BRT
	svc.now = func() time.Time { return time.Date(2026, 6, 1, 2, 30, 0, 0, time.UTC) }

	_, err := svc.GetMetrics(context.Background(), uuid.New())

	require.NoError(t, err)
	assert.Equal(t, brt, repo.gotNow.Location())
	y, m, d := repo.gotNow.Date()
	assert.Equal(t, []int{2026, 5, 31}, []int{y, int(m), d})
}

func TestService_NewService_LocNilUsaUTC(t *testing.T) {
	repo := &mockRepo{metrics: &Metrics{}}
	svc := NewService(repo, nil)

	_, err := svc.GetMetrics(context.Background(), uuid.New())

	require.NoError(t, err)
	assert.Equal(t, time.UTC, repo.gotNow.Location())
}

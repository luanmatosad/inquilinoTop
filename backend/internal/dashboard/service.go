package dashboard

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
	loc  *time.Location
	now  func() time.Time
}

// NewService recebe o fuso usado para definir "hoje" e o mês corrente; loc nil usa UTC.
func NewService(repo Repository, loc *time.Location) *Service {
	if loc == nil {
		loc = time.UTC
	}
	return &Service{repo: repo, loc: loc, now: time.Now}
}

// VacancyRate retorna o percentual de unidades vagas (0-100); 0 quando não há unidades.
func VacancyRate(totalUnits, occupiedUnits int) float64 {
	if totalUnits <= 0 {
		return 0
	}
	return math.Round(float64(totalUnits-occupiedUnits)/float64(totalUnits)*10000) / 100
}

func (s *Service) GetMetrics(ctx context.Context, orgID uuid.UUID) (*Metrics, error) {
	m, err := s.repo.GetMetrics(ctx, orgID, s.now().In(s.loc))
	if err != nil {
		return nil, fmt.Errorf("dashboard.svc: get metrics: %w", err)
	}
	if m.RecentPayments == nil {
		m.RecentPayments = []RecentPayment{}
	}
	if m.ExpiringLeases == nil {
		m.ExpiringLeases = []ExpiringLease{}
	}
	return m, nil
}

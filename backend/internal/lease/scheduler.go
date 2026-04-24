package lease

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

type IndexScheduler struct {
	svc     *Service
	ticker  *time.Ticker
	done    chan struct{}
}

func NewIndexScheduler(svc *Service) *IndexScheduler {
	return &IndexScheduler{
		svc:  svc,
		done: make(chan struct{}),
	}
}

func (s *IndexScheduler) Start(ctx context.Context, interval time.Duration) {
	s.ticker = time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-s.ticker.C:
				s.checkLeases(ctx)
			case <-s.done:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *IndexScheduler) Stop() {
	if s.ticker != nil {
		s.ticker.Stop()
	}
	close(s.done)
}

func (s *IndexScheduler) checkLeases(ctx context.Context) {
	// Dummy logic para check de contratos faltando 30 dias para vencer
	// Em implementação real, iteraríamos por todos os owners e contracts
	// listando contracts near expiration e buscando indices
	slog.Info("running lease check for adjustments")
}

package notification

import (
	"context"
	"log/slog"
	"time"
)

const defaultBatchSize = 50

type Worker struct {
	svc      *Service
	interval time.Duration
}

func NewWorker(svc *Service, interval time.Duration) *Worker {
	return &Worker{svc: svc, interval: interval}
}

// Start lança o worker em background. Retorna imediatamente; para quando ctx é cancelado.
func (w *Worker) Start(ctx context.Context) {
	go w.run(ctx)
}

func (w *Worker) run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := w.svc.ProcessQueue(ctx, defaultBatchSize); err != nil {
				slog.Error("notification worker: erro ao processar fila", "error", err)
			}
		}
	}
}

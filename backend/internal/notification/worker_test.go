package notification_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/notification"
	"github.com/stretchr/testify/assert"
)

type countingRepo struct {
	mockNotificationRepo
	processCallCount int32
}

func (c *countingRepo) ListPending(_ context.Context, limit int) ([]notification.Notification, error) {
	atomic.AddInt32(&c.processCallCount, 1)
	return nil, nil
}

func TestWorker_ProcessaFila(t *testing.T) {
	repo := &countingRepo{mockNotificationRepo: *newMockRepo()}
	svc := notification.NewService(repo, &mockEmailSender{})

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	ownerID := uuid.New()
	repo.Create(context.Background(), ownerID, notification.CreateNotificationInput{
		Type: "email", ToAddress: "test@test.com", Subject: "Assunto", Body: "Corpo",
	})

	w := notification.NewWorker(svc, 50*time.Millisecond)
	w.Start(ctx)

	// espera o contexto expirar
	<-ctx.Done()

	calls := atomic.LoadInt32(&repo.processCallCount)
	assert.GreaterOrEqual(t, int(calls), 2, "worker deve ter chamado ProcessQueue pelo menos 2x em 200ms com intervalo de 50ms")
}

func TestWorker_ParaQuandoContextoCancelado(t *testing.T) {
	repo := &countingRepo{mockNotificationRepo: *newMockRepo()}
	svc := notification.NewService(repo, &mockEmailSender{})

	ctx, cancel := context.WithCancel(context.Background())

	w := notification.NewWorker(svc, 30*time.Millisecond)
	w.Start(ctx)

	// permite 1-2 execuções antes de cancelar
	time.Sleep(70 * time.Millisecond)
	cancel()
	callsBefore := atomic.LoadInt32(&repo.processCallCount)

	// aguarda um pouco e verifica que não houve mais chamadas
	time.Sleep(80 * time.Millisecond)
	callsAfter := atomic.LoadInt32(&repo.processCallCount)

	assert.Equal(t, callsBefore, callsAfter, "após cancelar contexto, ProcessQueue não deve ser chamado novamente")
}

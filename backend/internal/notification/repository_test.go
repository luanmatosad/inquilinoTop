package notification_test

import (
	"context"
	"errors"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/notification"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testNotifDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE notifications, users CASCADE")
		d.Close()
	})
	return d
}

func newNotifOwner(t *testing.T, d *db.DB, email string) uuid.UUID {
	t.Helper()
	user, err := identity.NewRepository(d).CreateUser(context.Background(), email, "hash123")
	require.NoError(t, err)
	return user.ID
}

func newPendingNotif(t *testing.T, repo notification.Repository, ownerID uuid.UUID, to string, scheduledAt *string) uuid.UUID {
	t.Helper()
	n, err := repo.Create(context.Background(), ownerID, notification.CreateNotificationInput{
		Type: "email", ToAddress: to, Subject: "S", Body: "B", ScheduledAt: scheduledAt,
	})
	require.NoError(t, err)
	return n.ID
}

type notifState struct {
	status     string
	retryCount int
	sentAtSet  bool
}

// readNotifState lê o estado direto do banco: GetByID não serve para pendentes (sent_at é NULL).
func readNotifState(t *testing.T, d *db.DB, id uuid.UUID) notifState {
	t.Helper()
	var s notifState
	err := d.Pool.QueryRow(context.Background(),
		`SELECT status, retry_count, sent_at IS NOT NULL FROM notifications WHERE id=$1`, id,
	).Scan(&s.status, &s.retryCount, &s.sentAtSet)
	require.NoError(t, err)
	return s
}

func noopSend(notification.Notification) error { return nil }

func TestRepository_ReserveAndSend_SucessoMarcaEnviada(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	id := newPendingNotif(t, repo, newNotifOwner(t, d, "ok@test.com"), "dest@test.com", nil)

	var enviada notification.Notification
	reservou, err := repo.ReserveAndSend(context.Background(), id, func(n notification.Notification) error {
		enviada = n
		return nil
	})
	require.NoError(t, err)
	assert.True(t, reservou)
	assert.Equal(t, "dest@test.com", enviada.ToAddress)

	s := readNotifState(t, d, id)
	assert.Equal(t, "sent", s.status)
	assert.True(t, s.sentAtSet, "sent_at deve ser gravado no envio")
	assert.Equal(t, 0, s.retryCount)
}

func TestRepository_ReserveAndSend_FalhaAcumulaRetryEMantemPendente(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	id := newPendingNotif(t, repo, newNotifOwner(t, d, "fail@test.com"), "dest@test.com", nil)
	falha := func(notification.Notification) error { return errors.New("smtp fora") }

	for range 2 {
		reservou, err := repo.ReserveAndSend(context.Background(), id, falha)
		require.NoError(t, err)
		assert.True(t, reservou)
	}

	s := readNotifState(t, d, id)
	assert.Equal(t, "pending", s.status)
	assert.False(t, s.sentAtSet, "sent_at não deve ser gravado em falha")
	assert.Equal(t, 2, s.retryCount)
}

func TestRepository_ReserveAndSend_FalhasAteLimiteViramFailedESaemDaFila(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	ctx := context.Background()
	id := newPendingNotif(t, repo, newNotifOwner(t, d, "limite@test.com"), "dest@test.com", nil)
	falha := func(notification.Notification) error { return errors.New("smtp fora") }

	for range notification.MaxRetries {
		reservou, err := repo.ReserveAndSend(ctx, id, falha)
		require.NoError(t, err)
		require.True(t, reservou)
	}

	assert.Equal(t, "failed", readNotifState(t, d, id).status)

	ids, err := repo.ListPending(ctx, 10)
	require.NoError(t, err)
	assert.NotContains(t, ids, id)

	reservou, err := repo.ReserveAndSend(ctx, id, noopSend)
	require.NoError(t, err)
	assert.False(t, reservou, "notificação failed não pode ser reservada")
}

func TestRepository_ReserveAndSend_FalhaAbaixoDoLimiteSegueNaFila(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	ctx := context.Background()
	id := newPendingNotif(t, repo, newNotifOwner(t, d, "abaixo@test.com"), "dest@test.com", nil)
	falha := func(notification.Notification) error { return errors.New("smtp fora") }

	for range notification.MaxRetries - 1 {
		_, err := repo.ReserveAndSend(ctx, id, falha)
		require.NoError(t, err)
	}

	assert.Equal(t, "pending", readNotifState(t, d, id).status)
	ids, err := repo.ListPending(ctx, 10)
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{id}, ids)
}

func TestRepository_ListPending_AgendadaNoFuturoNaoEReservada(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	owner := newNotifOwner(t, d, "agenda@test.com")
	futuro := time.Now().Add(24 * time.Hour).Format(time.RFC3339)

	agora := newPendingNotif(t, repo, owner, "a@test.com", nil)
	agendada := newPendingNotif(t, repo, owner, "b@test.com", &futuro)

	ids, err := repo.ListPending(context.Background(), 10)
	require.NoError(t, err)
	assert.Equal(t, []uuid.UUID{agora}, ids)

	reservou, err := repo.ReserveAndSend(context.Background(), agendada, noopSend)
	require.NoError(t, err)
	assert.False(t, reservou)
	assert.Equal(t, "pending", readNotifState(t, d, agendada).status)
}

func TestRepository_ReserveAndSend_LinhaBloqueadaEPulada(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	id := newPendingNotif(t, repo, newNotifOwner(t, d, "locked@test.com"), "dest@test.com", nil)

	ctx := context.Background()
	tx, err := d.Pool.Begin(ctx)
	require.NoError(t, err)
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `SELECT id FROM notifications WHERE id=$1 FOR UPDATE`, id)
	require.NoError(t, err)

	type resultado struct {
		reservou bool
		err      error
	}
	ch := make(chan resultado, 1)
	var enviou atomic.Bool
	go func() {
		reservou, err := repo.ReserveAndSend(ctx, id, func(notification.Notification) error {
			enviou.Store(true)
			return nil
		})
		ch <- resultado{reservou, err}
	}()

	select {
	case r := <-ch:
		require.NoError(t, r.err)
		assert.False(t, r.reservou, "linha bloqueada por outro worker deve ser pulada")
	case <-time.After(2 * time.Second):
		t.Fatal("ReserveAndSend esperou a linha bloqueada em vez de pulá-la")
	}
	assert.False(t, enviou.Load(), "linha bloqueada não pode ser enviada")
}

func TestRepository_ReserveAndSend_ConcorrenteEnviaUmaVez(t *testing.T) {
	d := testNotifDB(t)
	repo := notification.NewRepository(d)
	id := newPendingNotif(t, repo, newNotifOwner(t, d, "race@test.com"), "dest@test.com", nil)

	var envios atomic.Int32
	send := func(notification.Notification) error {
		envios.Add(1)
		time.Sleep(100 * time.Millisecond)
		return nil
	}

	start := make(chan struct{})
	var wg sync.WaitGroup
	reservas := make([]bool, 2)
	erros := make([]error, 2)
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			reservas[i], erros[i] = repo.ReserveAndSend(context.Background(), id, send)
		}()
	}
	close(start)
	wg.Wait()

	verdadeiras := 0
	for i := range 2 {
		require.NoError(t, erros[i])
		if reservas[i] {
			verdadeiras++
		}
	}
	assert.Equal(t, 1, verdadeiras, "exatamente um worker deve reservar a notificação")
	assert.Equal(t, int32(1), envios.Load(), "o e-mail deve ser enviado uma única vez")
	assert.Equal(t, "sent", readNotifState(t, d, id).status)
}

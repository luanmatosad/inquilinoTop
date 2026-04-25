package notification_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/notification"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockNotificationRepo struct {
	notifications map[uuid.UUID]*notification.Notification
}

func newMockRepo() *mockNotificationRepo {
	return &mockNotificationRepo{notifications: make(map[uuid.UUID]*notification.Notification)}
}

func (m *mockNotificationRepo) Create(_ context.Context, ownerID uuid.UUID, in notification.CreateNotificationInput) (*notification.Notification, error) {
	n := &notification.Notification{
		ID:        uuid.New(),
		OwnerID:   ownerID,
		Type:      in.Type,
		ToAddress: in.ToAddress,
		Subject:   in.Subject,
		Body:      in.Body,
		Status:    "pending",
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	m.notifications[n.ID] = n
	return n, nil
}

func (m *mockNotificationRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*notification.Notification, error) {
	n, ok := m.notifications[id]
	if !ok || n.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return n, nil
}

func (m *mockNotificationRepo) ListPending(_ context.Context, limit int) ([]notification.Notification, error) {
	var list []notification.Notification
	for _, n := range m.notifications {
		if n.Status == "pending" {
			list = append(list, *n)
		}
	}
	return list, nil
}

func (m *mockNotificationRepo) ListByOwner(_ context.Context, ownerID uuid.UUID, status string) ([]notification.Notification, error) {
	var list []notification.Notification
	for _, n := range m.notifications {
		if n.OwnerID == ownerID && n.Status == status {
			list = append(list, *n)
		}
	}
	return list, nil
}

func (m *mockNotificationRepo) UpdateStatus(_ context.Context, id uuid.UUID, status notification.NotificationStatus, sentAt *time.Time) error {
	n, ok := m.notifications[id]
	if !ok {
		return errors.New("not found")
	}
	n.Status = string(status)
	return nil
}

func (m *mockNotificationRepo) IncrementRetry(_ context.Context, id uuid.UUID) error {
	n, ok := m.notifications[id]
	if !ok {
		return errors.New("not found")
	}
	n.RetryCount++
	return nil
}

type mockEmailSender struct{}

func (m *mockEmailSender) Send(_ context.Context, to, subject, body string) error {
	return nil
}

func TestService_ListByOwner_Pending_IsolatesOwner(t *testing.T) {
	repo := newMockRepo()
	svc := notification.NewService(repo, &mockEmailSender{})

	ownerA := uuid.New()
	ownerB := uuid.New()

	_, err := repo.Create(context.Background(), ownerA, notification.CreateNotificationInput{
		Type: "email", ToAddress: "a@test.com", Subject: "S", Body: "B",
	})
	require.NoError(t, err)

	_, err = repo.Create(context.Background(), ownerB, notification.CreateNotificationInput{
		Type: "email", ToAddress: "b@test.com", Subject: "S", Body: "B",
	})
	require.NoError(t, err)

	result, err := svc.ListByOwner(context.Background(), ownerA, "pending")
	require.NoError(t, err)

	assert.Len(t, result, 1, "ListByOwner com status=pending deve retornar só as notificações do ownerA")
	if len(result) == 1 {
		assert.Equal(t, ownerA, result[0].OwnerID, "notificação retornada deve pertencer ao ownerA")
	}
}

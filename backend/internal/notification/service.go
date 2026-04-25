package notification

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo        Repository
	emailSender EmailSender
}

func NewService(repo Repository, emailSender EmailSender) *Service {
	return &Service{repo: repo, emailSender: emailSender}
}

func (s *Service) CreateNotification(ctx context.Context, ownerID uuid.UUID, in CreateNotificationInput) (*Notification, error) {
	if in.Type != "email" && in.Type != "sms" && in.Type != "push" {
		return nil, fmt.Errorf("notification.svc: tipo inválido")
	}
	return s.repo.Create(ctx, ownerID, in)
}

func (s *Service) ListByOwner(ctx context.Context, ownerID uuid.UUID, status string) ([]Notification, error) {
	return s.repo.ListByOwner(ctx, ownerID, status)
}

func (s *Service) GetNotification(ctx context.Context, id, ownerID uuid.UUID) (*Notification, error) {
	return s.repo.GetByID(ctx, id, ownerID)
}

func (s *Service) ProcessQueue(ctx context.Context, limit int) error {
	notifications, err := s.repo.ListPending(ctx, limit)
	if err != nil {
		return err
	}

	for _, n := range notifications {
		if err := s.processNotification(ctx, n); err != nil {
			s.repo.IncrementRetry(ctx, n.ID)
			continue
		}
		now := time.Now()
		s.repo.UpdateStatus(ctx, n.ID, StatusSent, &now)
	}
	return nil
}

func (s *Service) processNotification(ctx context.Context, n Notification) error {
	switch n.Type {
	case "email":
		return s.emailSender.Send(ctx, n.ToAddress, n.Subject, n.Body)
	default:
		return fmt.Errorf("notification.svc: tipo [%s] não implementado", n.Type)
	}
}
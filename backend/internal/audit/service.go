package audit

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) LogLogin(ctx context.Context, ownerID, userID uuid.UUID, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		UserID:    &userID,
		EventType: string(EventLogin),
		IPAddress: &ipAddress,
	})
}

func (s *Service) LogLogout(ctx context.Context, ownerID, userID uuid.UUID, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		UserID:    &userID,
		EventType: string(EventLogout),
		IPAddress: &ipAddress,
	})
}

func (s *Service) LogFailedLogin(ctx context.Context, ownerID uuid.UUID, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		EventType: string(EventFailedLogin),
		IPAddress: &ipAddress,
	})
}

func (s *Service) LogCreate(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID, userID uuid.UUID, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		UserID:     &userID,
		EventType:  string(EventCreate),
		EntityType: &entityType,
		EntityID:   &entityID,
		IPAddress:  &ipAddress,
	})
}

func (s *Service) LogUpdate(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID, userID uuid.UUID, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		UserID:     &userID,
		EventType:  string(EventUpdate),
		EntityType: &entityType,
		EntityID:   &entityID,
		IPAddress:  &ipAddress,
	})
}

func (s *Service) LogDelete(ctx context.Context, ownerID uuid.UUID, entityType string, entityID uuid.UUID, userID uuid.UUID, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		UserID:     &userID,
		EventType:  string(EventDelete),
		EntityType: &entityType,
		EntityID:   &entityID,
		IPAddress:  &ipAddress,
	})
}

func (s *Service) LogPermissionDenied(ctx context.Context, ownerID uuid.UUID, userID uuid.UUID, resource string, ipAddress string) {
	s.repo.Create(ctx, ownerID, CreateInput{
		UserID:    &userID,
		EventType: string(EventPermissionDenied),
		Details:  map[string]string{"resource": resource},
		IPAddress: &ipAddress,
	})
}

func (s *Service) ListLogs(ctx context.Context, ownerID uuid.UUID, from, to *time.Time, eventType *string) ([]AuditLog, error) {
	return s.repo.List(ctx, ownerID, from, to, eventType)
}
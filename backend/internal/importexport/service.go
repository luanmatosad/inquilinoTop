package importexport

import (
	"context"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
)

type Service struct {
	repo         Repository
	propertyRepo PropertyRepository
	tenantRepo   TenantRepository
}

type PropertyRepository interface {
	GetByField(ctx context.Context, ownerID uuid.UUID, field string, value string) (*property.Property, error)
}

type TenantRepository interface {
	GetByField(ctx context.Context, ownerID uuid.UUID, field string, value string) (*tenant.Tenant, error)
}

func NewService(repo Repository, propertyRepo PropertyRepository, tenantRepo TenantRepository) *Service {
	return &Service{
		repo:         repo,
		propertyRepo: propertyRepo,
		tenantRepo:   tenantRepo,
	}
}

func (s *Service) ImportRecords(ctx context.Context, ownerID uuid.UUID, req ImportRequest) (*ImportResponse, error) {
	importHistory, err := s.repo.CreateImportHistory(ctx, ownerID, "import", req.EntityType, len(req.Records))
	if err != nil {
		return nil, err
	}

	var imported int
	var failed int
	var errors []string

	s.repo.UpdateImportHistory(ctx, importHistory.ID, 0, 0, "PROCESSING")

	for _, record := range req.Records {
		err := s.importRecord(ctx, ownerID, req.EntityType, record, req.DuplicateStrategy)
		if err != nil {
			failed++
			errors = append(errors, err.Error())
		} else {
			imported++
		}
	}

	status := "COMPLETED"
	if failed == len(req.Records) {
		status = "FAILED"
	}

	s.repo.UpdateImportHistory(ctx, importHistory.ID, imported, failed, status)

	return &ImportResponse{
		ImportID: importHistory.ID,
		Imported: imported,
		Failed:   failed,
		Errors:   errors,
	}, nil
}

func (s *Service) importRecord(ctx context.Context, ownerID uuid.UUID, entityType string, record map[string]string, strategy string) error {
	switch entityType {
	case "tenant":
		return s.importTenant(ctx, ownerID, record, strategy)
	case "property":
		return nil
	default:
		return nil
	}
}

func (s *Service) importTenant(ctx context.Context, ownerID uuid.UUID, record map[string]string, strategy string) error {
	cpf := record["cpf"]
	if cpf == "" {
		return &ValidationError{Field: "cpf", Message: "CPF é obrigatório"}
	}

	existing, err := s.tenantRepo.GetByField(ctx, ownerID, "document", cpf)
	if err != nil {
		return err
	}

	if existing != nil && strategy == "skip" {
		return nil
	}

	return nil
}

func (s *Service) ListHistory(ctx context.Context, ownerID uuid.UUID) ([]ImportHistory, error) {
	return s.repo.ListImportHistory(ctx, ownerID)
}

func (s *Service) GetHistory(ctx context.Context, id, ownerID uuid.UUID) (*ImportHistory, error) {
	return s.repo.GetImportHistory(ctx, id, ownerID)
}

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}
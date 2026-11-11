package importexport

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
)

type Service struct {
	repo    Repository
	tenants TenantCreator
}

// TenantCreator cria inquilinos escopados por organização; satisfeita por *tenant.Service.
type TenantCreator interface {
	Create(ctx context.Context, userID, orgID uuid.UUID, in tenant.CreateTenantInput) (*tenant.Tenant, error)
}

func NewService(repo Repository, tenants TenantCreator) *Service {
	return &Service{
		repo:    repo,
		tenants: tenants,
	}
}

// ImportRecords importa os registros. O histórico é escopado por ownerID; as entidades
// importadas são gravadas na organização orgID, em nome de userID.
func (s *Service) ImportRecords(ctx context.Context, ownerID, userID, orgID uuid.UUID, req ImportRequest) (*ImportResponse, error) {
	importHistory, err := s.repo.CreateImportHistory(ctx, ownerID, "import", req.EntityType, len(req.Records))
	if err != nil {
		return nil, fmt.Errorf("importexport.svc: criar histórico: %w", err)
	}

	if err := s.repo.UpdateImportHistory(ctx, importHistory.ID, 0, 0, "PROCESSING"); err != nil {
		return nil, fmt.Errorf("importexport.svc: atualizar histórico: %w", err)
	}

	var imported, failed, skipped int
	errs := []string{}

	for i, record := range req.Records {
		err := s.importRecord(ctx, userID, orgID, req.EntityType, record)
		switch {
		case err == nil:
			imported++
		case errors.Is(err, tenant.ErrDuplicateDocument) && req.DuplicateStrategy == "skip":
			skipped++
		case errors.Is(err, tenant.ErrDuplicateDocument):
			failed++
			errs = append(errs, fmt.Sprintf("linha %d: documento já cadastrado", i+1))
		default:
			failed++
			errs = append(errs, fmt.Sprintf("linha %d: %s", i+1, err.Error()))
		}
	}

	status := "COMPLETED"
	if len(req.Records) > 0 && failed == len(req.Records) {
		status = "FAILED"
	}

	if err := s.repo.UpdateImportHistory(ctx, importHistory.ID, imported, failed, status); err != nil {
		return nil, fmt.Errorf("importexport.svc: finalizar histórico: %w", err)
	}

	return &ImportResponse{
		ImportID: importHistory.ID,
		Imported: imported,
		Failed:   failed,
		Skipped:  skipped,
		Errors:   errs,
	}, nil
}

func (s *Service) importRecord(ctx context.Context, userID, orgID uuid.UUID, entityType string, record map[string]string) error {
	switch entityType {
	case "tenant":
		return s.importTenant(ctx, userID, orgID, record)
	default:
		return fmt.Errorf("entity_type %q não suportado", entityType)
	}
}

func (s *Service) importTenant(ctx context.Context, userID, orgID uuid.UUID, record map[string]string) error {
	doc := firstNonEmpty(record, "cpf", "cnpj", "document")
	personType := "PF"
	if strings.EqualFold(strings.TrimSpace(record["person_type"]), "PJ") || strings.TrimSpace(record["cnpj"]) != "" {
		personType = "PJ"
	}

	in := tenant.CreateTenantInput{
		Name:        strings.TrimSpace(record["name"]),
		Document:    optional(doc),
		PersonType:  &personType,
		Email:       optional(record["email"]),
		Phone:       optional(record["phone"]),
		PostalCode:  optional(record["postal_code"]),
		AddressLine: optional(record["address_line"]),
		City:        optional(record["city"]),
		State:       optional(record["state"]),
		Notes:       optional(record["notes"]),
	}

	if _, err := s.tenants.Create(ctx, userID, orgID, in); err != nil {
		return err
	}
	return nil
}

func firstNonEmpty(m map[string]string, keys ...string) string {
	for _, k := range keys {
		if v := strings.TrimSpace(m[k]); v != "" {
			return v
		}
	}
	return ""
}

func optional(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func (s *Service) ListHistory(ctx context.Context, ownerID uuid.UUID) ([]ImportHistory, error) {
	return s.repo.ListImportHistory(ctx, ownerID)
}

package tenant

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/brdoc"
)

type Service struct {
	repo   Repository
	leases LeaseChecker
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// WithLeaseChecker habilita o bloqueio de exclusão de inquilino com contrato ativo.
func (s *Service) WithLeaseChecker(c LeaseChecker) *Service {
	s.leases = c
	return s
}

func validatePersonType(pt *string) error {
	if pt == nil {
		return fmt.Errorf("tenant.svc: person_type é obrigatório")
	}
	if *pt != "PF" && *pt != "PJ" {
		return fmt.Errorf("tenant.svc: person_type inválido")
	}
	return nil
}

// normalizeDocument devolve o documento só com dígitos, validado conforme o tipo
// (PF→CPF, PJ→CNPJ). Documento vazio vira nil.
func normalizeDocument(doc *string, personType string) (*string, error) {
	if doc == nil || strings.TrimSpace(*doc) == "" {
		return nil, nil
	}
	digits := brdoc.OnlyDigits(*doc)
	valid := (personType == "PF" && brdoc.ValidCPF(digits)) || (personType == "PJ" && brdoc.ValidCNPJ(digits))
	if !valid {
		return nil, ErrInvalidDocument
	}
	return &digits, nil
}

// ensureDocumentFree rejeita documento usado por outro inquilino ativo da organização.
func (s *Service) ensureDocumentFree(ctx context.Context, orgID, exceptID uuid.UUID, doc *string) error {
	if doc == nil {
		return nil
	}
	existing, err := s.repo.GetByField(ctx, orgID, "document", *doc)
	if err != nil {
		return fmt.Errorf("tenant.svc: checar documento: %w", err)
	}
	if existing != nil && existing.ID != exceptID {
		return ErrDuplicateDocument
	}
	return nil
}

func (s *Service) Create(ctx context.Context, userID, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if err := validatePersonType(in.PersonType); err != nil {
		return nil, err
	}
	if in.Name == "" {
		return nil, fmt.Errorf("tenant.svc: nome é obrigatório")
	}
	doc, err := normalizeDocument(in.Document, *in.PersonType)
	if err != nil {
		return nil, err
	}
	in.Document = doc
	if err := s.ensureDocumentFree(ctx, orgID, uuid.Nil, doc); err != nil {
		return nil, err
	}
	return s.repo.Create(ctx, userID, orgID, in)
}

func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Tenant, error) {
	return s.repo.GetByID(ctx, id, orgID)
}

func (s *Service) List(ctx context.Context, orgID uuid.UUID) ([]Tenant, error) {
	return s.repo.List(ctx, orgID)
}

func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in CreateTenantInput) (*Tenant, error) {
	if err := validatePersonType(in.PersonType); err != nil {
		return nil, err
	}
	doc, err := normalizeDocument(in.Document, *in.PersonType)
	if err != nil {
		return nil, err
	}
	in.Document = doc
	if err := s.ensureDocumentFree(ctx, orgID, id, doc); err != nil {
		return nil, err
	}
	return s.repo.Update(ctx, id, orgID, in)
}

func (s *Service) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	if _, err := s.repo.GetByID(ctx, id, orgID); err != nil {
		return err
	}
	if s.leases != nil {
		active, err := s.leases.HasActiveLease(ctx, id, orgID)
		if err != nil {
			return fmt.Errorf("tenant.svc: checar contrato ativo: %w", err)
		}
		if active {
			return ErrHasActiveLease
		}
	}
	return s.repo.Delete(ctx, id, orgID)
}

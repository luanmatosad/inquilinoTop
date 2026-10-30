package inspection

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
)

type Service struct {
	repo    Repository
	leases  LeaseReader
	auditor Auditor
	now     func() time.Time
}

func NewService(repo Repository, leases LeaseReader) *Service {
	return &Service{repo: repo, leases: leases, now: time.Now}
}

// WithAuditor habilita o registro de auditoria de criação e conclusão.
func (s *Service) WithAuditor(a Auditor) *Service {
	s.auditor = a
	return s
}

func (s *Service) requireLease(ctx context.Context, leaseID, orgID uuid.UUID) error {
	if _, err := s.leases.GetByID(ctx, leaseID, orgID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			return ErrLeaseNotFound
		}
		return fmt.Errorf("inspection.svc: buscar contrato: %w", err)
	}
	return nil
}

// Create cria o laudo em DRAFT. Em EXIT com CopyFromEntry, copia os itens do ENTRY ativo (se houver).
func (s *Service) Create(ctx context.Context, orgID, userID uuid.UUID, in CreateInspectionInput) (*Detail, error) {
	if err := s.requireLease(ctx, in.LeaseID, orgID); err != nil {
		return nil, err
	}
	created, err := s.repo.Create(ctx, orgID, in)
	if err != nil {
		return nil, err
	}

	if in.Type == TypeExit && in.CopyFromEntry {
		entry, err := s.repo.GetActiveByLeaseAndType(ctx, in.LeaseID, orgID, TypeEntry)
		switch {
		case err == nil:
			if _, err := s.repo.CopyItems(ctx, entry.ID, created.ID, orgID); err != nil {
				// não deixa um EXIT pela metade ocupando o tipo do contrato
				_ = s.repo.Delete(ctx, created.ID, orgID)
				return nil, fmt.Errorf("inspection.svc: copiar itens da entrada: %w", err)
			}
		case errors.Is(err, apierr.ErrNotFound):
			// sem laudo de entrada: cria o EXIT vazio
		default:
			_ = s.repo.Delete(ctx, created.ID, orgID)
			return nil, fmt.Errorf("inspection.svc: buscar entrada: %w", err)
		}
	}

	if s.auditor != nil {
		s.auditor.LogCreate(ctx, userID, "inspection", created.ID, userID, "")
	}
	return s.Get(ctx, created.ID, orgID)
}

// Get devolve o laudo com os itens ativos (nunca nil).
func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Detail, error) {
	insp, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.ListItems(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []Item{}
	}
	return &Detail{Inspection: *insp, Items: items}, nil
}

func validType(t string) bool   { return t == "" || t == TypeEntry || t == TypeExit }
func validStatus(s string) bool { return s == "" || s == StatusDraft || s == StatusCompleted }

func (s *Service) List(ctx context.Context, orgID uuid.UUID, f Filter) ([]Inspection, error) {
	if !validType(f.Type) || !validStatus(f.Status) {
		return nil, ErrInvalidFilter
	}
	list, err := s.repo.List(ctx, orgID, f)
	if err != nil {
		return nil, err
	}
	if list == nil {
		list = []Inspection{}
	}
	return list, nil
}

func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in UpdateInspectionInput) (*Inspection, error) {
	return s.repo.Update(ctx, id, orgID, in)
}

func (s *Service) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	return s.repo.Delete(ctx, id, orgID)
}

// editableDraft garante que o laudo existe na organização e ainda está em DRAFT.
func (s *Service) editableDraft(ctx context.Context, id, orgID uuid.UUID) error {
	insp, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return err
	}
	if insp.Status != StatusDraft {
		return ErrNotEditable
	}
	return nil
}

func (s *Service) AddItem(ctx context.Context, inspectionID, orgID uuid.UUID, in ItemInput) (*Item, error) {
	if err := s.editableDraft(ctx, inspectionID, orgID); err != nil {
		return nil, err
	}
	return s.repo.CreateItem(ctx, inspectionID, orgID, in)
}

func (s *Service) UpdateItem(ctx context.Context, id, inspectionID, orgID uuid.UUID, in ItemInput) (*Item, error) {
	if err := s.editableDraft(ctx, inspectionID, orgID); err != nil {
		return nil, err
	}
	return s.repo.UpdateItem(ctx, id, inspectionID, orgID, in)
}

func (s *Service) DeleteItem(ctx context.Context, id, inspectionID, orgID uuid.UUID) error {
	if err := s.editableDraft(ctx, inspectionID, orgID); err != nil {
		return err
	}
	return s.repo.DeleteItem(ctx, id, inspectionID, orgID)
}

// Complete conclui um DRAFT com pelo menos um item; depois disso o laudo é imutável.
func (s *Service) Complete(ctx context.Context, id, orgID, userID uuid.UUID) (*Inspection, error) {
	if err := s.editableDraft(ctx, id, orgID); err != nil {
		return nil, err
	}
	items, err := s.repo.ListItems(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNoItems
	}
	done, err := s.repo.Complete(ctx, id, orgID, s.now())
	if err != nil {
		return nil, err
	}
	if s.auditor != nil {
		s.auditor.LogUpdate(ctx, userID, "inspection", id, userID, "")
	}
	return done, nil
}

// severity ordena GOOD < FAIR < POOR < DAMAGED; NOT_APPLICABLE fica fora da comparação.
func severity(condition string) (int, bool) {
	switch condition {
	case ConditionGood:
		return 0, true
	case ConditionFair:
		return 1, true
	case ConditionPoor:
		return 2, true
	case ConditionDamaged:
		return 3, true
	}
	return 0, false
}

func pairKey(room, item string) string {
	return strings.ToLower(strings.TrimSpace(room)) + "\x00" + strings.ToLower(strings.TrimSpace(item))
}

// Compare pareia os itens do ENTRY e do EXIT concluídos do contrato. Itens só de um lado aparecem
// com o outro nulo. Chave repetida dentro de um laudo: vale o primeiro item.
func (s *Service) Compare(ctx context.Context, leaseID, orgID uuid.UUID) (*Comparison, error) {
	if err := s.requireLease(ctx, leaseID, orgID); err != nil {
		return nil, err
	}
	load := func(typ string) (*Inspection, []Item, error) {
		insp, err := s.repo.GetActiveByLeaseAndType(ctx, leaseID, orgID, typ)
		if err != nil {
			if errors.Is(err, apierr.ErrNotFound) {
				return nil, nil, ErrComparisonUnavailable
			}
			return nil, nil, err
		}
		if insp.Status != StatusCompleted {
			return nil, nil, ErrComparisonUnavailable
		}
		items, err := s.repo.ListItems(ctx, insp.ID, orgID)
		return insp, items, err
	}
	entry, entryItems, err := load(TypeEntry)
	if err != nil {
		return nil, err
	}
	exit, exitItems, err := load(TypeExit)
	if err != nil {
		return nil, err
	}

	rows := make([]ComparisonRow, 0, len(entryItems))
	index := map[string]int{}
	for _, it := range entryItems {
		k := pairKey(it.Room, it.Item)
		if _, dup := index[k]; dup {
			continue
		}
		c, n := it.Condition, it.Notes
		index[k] = len(rows)
		rows = append(rows, ComparisonRow{Room: it.Room, Item: it.Item, EntryCondition: &c, EntryNotes: n})
	}
	seenExit := map[string]bool{}
	for _, it := range exitItems {
		k := pairKey(it.Room, it.Item)
		if seenExit[k] {
			continue
		}
		seenExit[k] = true
		c, n := it.Condition, it.Notes
		if i, ok := index[k]; ok {
			rows[i].ExitCondition, rows[i].ExitNotes = &c, n
			in, okIn := severity(*rows[i].EntryCondition)
			out, okOut := severity(c)
			rows[i].Worsened = okIn && okOut && out > in
			continue
		}
		rows = append(rows, ComparisonRow{Room: it.Room, Item: it.Item, ExitCondition: &c, ExitNotes: n})
	}
	return &Comparison{LeaseID: leaseID, Entry: *entry, Exit: *exit, Rows: rows}, nil
}

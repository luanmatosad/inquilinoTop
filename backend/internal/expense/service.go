package expense

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo    Repository
	auditor Auditor
	loc     *time.Location
	now     func() time.Time
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, loc: time.UTC, now: time.Now}
}

// WithAuditor habilita o registro de auditoria da baixa e do estorno.
func (s *Service) WithAuditor(a Auditor) *Service {
	s.auditor = a
	return s
}

// WithLocation define o fuso usado para decidir o que é "hoje" (vencida ou a vencer).
func (s *Service) WithLocation(loc *time.Location) *Service {
	s.loc = loc
	return s
}

// WithClock troca o relógio (testes).
func (s *Service) WithClock(now func() time.Time) *Service {
	s.now = now
	return s
}

func (s *Service) today() time.Time {
	y, m, d := s.now().In(s.loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// withStatus devolve uma cópia com LATE derivado (PENDING com vencimento anterior a hoje);
// o registro original não é alterado.
func (s *Service) withStatus(e *Expense) *Expense {
	out := *e
	if out.Status == StatusPending && out.DueDate.Before(s.today()) {
		out.Status = StatusLate
	}
	return &out
}

func (s *Service) Create(ctx context.Context, userID, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	e, err := s.repo.Create(ctx, userID, orgID, in)
	if err != nil {
		return nil, err
	}
	return s.withStatus(e), nil
}

func (s *Service) Get(ctx context.Context, id, orgID uuid.UUID) (*Expense, error) {
	e, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	return s.withStatus(e), nil
}

func (s *Service) ListByUnit(ctx context.Context, unitID, orgID uuid.UUID) ([]Expense, error) {
	list, err := s.repo.ListByUnit(ctx, unitID, orgID)
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i] = *s.withStatus(&list[i])
	}
	return list, nil
}

// List aplica status, período e unidade em SQL e devolve LATE derivado.
func (s *Service) List(ctx context.Context, orgID uuid.UUID, f ListFilter) ([]Expense, error) {
	if !validStatusFilter(f.Status) {
		return nil, ErrInvalidFilter
	}
	list, err := s.repo.List(ctx, orgID, f, s.today())
	if err != nil {
		return nil, err
	}
	for i := range list {
		list[i] = *s.withStatus(&list[i])
	}
	return list, nil
}

// ListByOwner lista todas as despesas da organização, sem filtro.
func (s *Service) ListByOwner(ctx context.Context, orgID uuid.UUID) ([]Expense, error) {
	return s.List(ctx, orgID, ListFilter{})
}

func (s *Service) Summary(ctx context.Context, orgID uuid.UUID, f ListFilter) (Summary, error) {
	// O resumo sempre separa os três grupos; filtro de status não se aplica.
	f.Status = ""
	return s.repo.Summary(ctx, orgID, f, s.today())
}

func validStatusFilter(status string) bool {
	switch status {
	case "", StatusPending, StatusLate, StatusPaid:
		return true
	}
	return false
}

// Update altera os dados da despesa. Em despesa PAID, valor e vencimento ficam travados.
func (s *Service) Update(ctx context.Context, id, orgID uuid.UUID, in CreateExpenseInput) (*Expense, error) {
	current, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if current.Status == StatusPaid && (in.Amount != current.Amount || !sameDay(in.DueDate, current.DueDate)) {
		return nil, ErrLocked
	}
	e, err := s.repo.Update(ctx, id, orgID, in)
	if err != nil {
		return nil, err
	}
	return s.withStatus(e), nil
}

func sameDay(a, b time.Time) bool {
	ay, am, ad := a.UTC().Date()
	by, bm, bd := b.UTC().Date()
	return ay == by && am == bm && ad == bd
}

func (s *Service) Delete(ctx context.Context, id, orgID uuid.UUID) error {
	return s.repo.Delete(ctx, id, orgID)
}

// Pay dá baixa na despesa PENDING (ou LATE). Sem paid_amount, assume o valor da despesa.
func (s *Service) Pay(ctx context.Context, id, orgID, userID uuid.UUID, in PayExpenseInput) (*Expense, error) {
	current, err := s.repo.GetByID(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	if current.Status == StatusPaid {
		return nil, ErrAlreadyPaid
	}
	amount := current.Amount
	if in.PaidAmount != nil {
		amount = *in.PaidAmount
	}
	amount = round2(amount)
	if amount <= 0 {
		return nil, fmt.Errorf("expense.svc: valor pago deve ser maior que zero")
	}
	e, err := s.repo.MarkPaid(ctx, id, orgID, in.PaidDate, amount)
	if err != nil {
		return nil, err
	}
	s.audit(ctx, userID, "expense:pay", id)
	return e, nil
}

// Unpay desfaz a baixa: volta a PENDING e limpa data e valor pagos.
func (s *Service) Unpay(ctx context.Context, id, orgID, userID uuid.UUID) (*Expense, error) {
	if _, err := s.repo.GetByID(ctx, id, orgID); err != nil {
		return nil, err
	}
	e, err := s.repo.MarkUnpaid(ctx, id, orgID)
	if err != nil {
		return nil, err
	}
	s.audit(ctx, userID, "expense:unpay", id)
	return s.withStatus(e), nil
}

// audit registra a ação. O audit.Service espera o usuário como "owner" (FK para users) e lê a
// organização do contexto da requisição; passar a organização aqui violaria a FK sem aviso.
func (s *Service) audit(ctx context.Context, userID uuid.UUID, entityType string, id uuid.UUID) {
	if s.auditor != nil {
		s.auditor.LogUpdate(ctx, userID, entityType, id, userID, "")
	}
}

func round2(x float64) float64 { return math.Round(x*100) / 100 }

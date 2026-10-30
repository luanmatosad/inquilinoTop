package expense_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockExpenseRepo struct {
	expenses map[uuid.UUID]*expense.Expense
}

func newMockExpenseRepo() *mockExpenseRepo {
	return &mockExpenseRepo{expenses: make(map[uuid.UUID]*expense.Expense)}
}

func (m *mockExpenseRepo) Create(_ context.Context, _, orgID uuid.UUID, in expense.CreateExpenseInput) (*expense.Expense, error) {
	e := &expense.Expense{
		ID:             uuid.New(),
		OrganizationID: orgID,
		UnitID:         in.UnitID,
		Description:    in.Description,
		Amount:         in.Amount,
		DueDate:        in.DueDate,
		Category:       in.Category,
		Status:         expense.StatusPending,
		IsActive:       true,
	}
	m.expenses[e.ID] = e
	return e, nil
}

func (m *mockExpenseRepo) GetByID(_ context.Context, id, orgID uuid.UUID) (*expense.Expense, error) {
	e, ok := m.expenses[id]
	if !ok || e.OrganizationID != orgID || !e.IsActive {
		return nil, apierr.ErrNotFound
	}
	return e, nil
}

func (m *mockExpenseRepo) ListByUnit(_ context.Context, unitID, orgID uuid.UUID) ([]expense.Expense, error) {
	var list []expense.Expense
	for _, e := range m.expenses {
		if e.UnitID == unitID && e.OrganizationID == orgID && e.IsActive {
			list = append(list, *e)
		}
	}
	return list, nil
}

func (m *mockExpenseRepo) Update(_ context.Context, id, orgID uuid.UUID, in expense.CreateExpenseInput) (*expense.Expense, error) {
	e, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	e.Description = in.Description
	e.Amount = in.Amount
	e.Category = in.Category
	return e, nil
}

func (m *mockExpenseRepo) List(_ context.Context, orgID uuid.UUID, f expense.ListFilter, today time.Time) ([]expense.Expense, error) {
	var list []expense.Expense
	for _, e := range m.expenses {
		if e.OrganizationID != orgID || !e.IsActive {
			continue
		}
		switch f.Status {
		case expense.StatusPending:
			if e.Status != expense.StatusPending || e.DueDate.Before(today) {
				continue
			}
		case expense.StatusLate:
			if e.Status != expense.StatusPending || !e.DueDate.Before(today) {
				continue
			}
		case expense.StatusPaid:
			if e.Status != expense.StatusPaid {
				continue
			}
		}
		if f.From != nil && e.DueDate.Before(*f.From) {
			continue
		}
		if f.To != nil && e.DueDate.After(*f.To) {
			continue
		}
		if f.UnitID != nil && e.UnitID != *f.UnitID {
			continue
		}
		list = append(list, *e)
	}
	return list, nil
}

func (m *mockExpenseRepo) MarkPaid(_ context.Context, id, orgID uuid.UUID, paidDate time.Time, paidAmount float64) (*expense.Expense, error) {
	e, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	if e.Status == expense.StatusPaid {
		return nil, expense.ErrAlreadyPaid
	}
	e.Status, e.PaidDate, e.PaidAmount = expense.StatusPaid, &paidDate, &paidAmount
	return e, nil
}

func (m *mockExpenseRepo) MarkUnpaid(_ context.Context, id, orgID uuid.UUID) (*expense.Expense, error) {
	e, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	if e.Status != expense.StatusPaid {
		return nil, expense.ErrNotPaid
	}
	e.Status, e.PaidDate, e.PaidAmount = expense.StatusPending, nil, nil
	return e, nil
}

func (m *mockExpenseRepo) Summary(ctx context.Context, orgID uuid.UUID, f expense.ListFilter, today time.Time) (expense.Summary, error) {
	var s expense.Summary
	list, _ := m.List(ctx, orgID, expense.ListFilter{From: f.From, To: f.To, UnitID: f.UnitID}, today)
	for _, e := range list {
		switch {
		case e.Status == expense.StatusPaid:
			s.Paid.Count++
			s.Paid.Total += *e.PaidAmount
		case e.DueDate.Before(today):
			s.Overdue.Count++
			s.Overdue.Total += e.Amount
		default:
			s.ToPay.Count++
			s.ToPay.Total += e.Amount
		}
	}
	return s, nil
}

func (m *mockExpenseRepo) Delete(_ context.Context, id, orgID uuid.UUID) error {
	e, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return err
	}
	e.IsActive = false
	return nil
}

func TestService_Create_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	orgID := uuid.New()
	unitID := uuid.New()

	e, err := svc.Create(context.Background(), uuid.New(), orgID, expense.CreateExpenseInput{
		UnitID:      unitID,
		Description: "Água",
		Amount:      150,
		DueDate:     time.Now(),
		Category:    "WATER",
	})
	require.NoError(t, err)
	assert.Equal(t, "WATER", e.Category)
	assert.Equal(t, unitID, e.UnitID)
}

func TestService_Get_Encontrado(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	orgID := uuid.New()

	e, _ := svc.Create(context.Background(), uuid.New(), orgID, expense.CreateExpenseInput{
		UnitID: uuid.New(), Description: "Luz", Amount: 100, DueDate: time.Now(), Category: "ELECTRICITY",
	})
	found, err := svc.Get(context.Background(), e.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, e.ID, found.ID)
}

func TestService_Get_NãoEncontrado(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	_, err := svc.Get(context.Background(), uuid.New(), uuid.New())
	assert.Error(t, err)
}

func TestService_ListByUnit(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	orgID := uuid.New()
	unitID := uuid.New()

	svc.Create(context.Background(), uuid.New(), orgID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Água", Amount: 100, DueDate: time.Now(), Category: "WATER",
	})
	svc.Create(context.Background(), uuid.New(), orgID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Luz", Amount: 200, DueDate: time.Now(), Category: "ELECTRICITY",
	})

	list, err := svc.ListByUnit(context.Background(), unitID, orgID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	orgID := uuid.New()

	e, _ := svc.Create(context.Background(), uuid.New(), orgID, expense.CreateExpenseInput{
		UnitID: uuid.New(), Description: "Original", Amount: 100, DueDate: time.Now(), Category: "OTHER",
	})
	updated, err := svc.Update(context.Background(), e.ID, orgID, expense.CreateExpenseInput{
		UnitID: e.UnitID, Description: "Atualizado", Amount: 200, DueDate: time.Now(), Category: "MAINTENANCE",
	})
	require.NoError(t, err)
	assert.Equal(t, "Atualizado", updated.Description)
	assert.Equal(t, "MAINTENANCE", updated.Category)
}

func TestService_Delete(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	orgID := uuid.New()
	unitID := uuid.New()

	e, _ := svc.Create(context.Background(), uuid.New(), orgID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Para deletar", Amount: 50, DueDate: time.Now(), Category: "OTHER",
	})
	err := svc.Delete(context.Background(), e.ID, orgID)
	require.NoError(t, err)

	list, _ := svc.ListByUnit(context.Background(), unitID, orgID)
	assert.Len(t, list, 0)
}

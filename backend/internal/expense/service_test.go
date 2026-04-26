package expense_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockExpenseRepo struct {
	expenses map[uuid.UUID]*expense.Expense
}

func newMockExpenseRepo() *mockExpenseRepo {
	return &mockExpenseRepo{expenses: make(map[uuid.UUID]*expense.Expense)}
}

func (m *mockExpenseRepo) Create(_ context.Context, ownerID uuid.UUID, in expense.CreateExpenseInput) (*expense.Expense, error) {
	e := &expense.Expense{
		ID:          uuid.New(),
		OwnerID:     ownerID,
		UnitID:      in.UnitID,
		Description: in.Description,
		Amount:      in.Amount,
		DueDate:     in.DueDate,
		Category:    in.Category,
		IsActive:    true,
	}
	m.expenses[e.ID] = e
	return e, nil
}

func (m *mockExpenseRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*expense.Expense, error) {
	e, ok := m.expenses[id]
	if !ok || e.OwnerID != ownerID || !e.IsActive {
		return nil, errors.New("not found")
	}
	return e, nil
}

func (m *mockExpenseRepo) ListByUnit(_ context.Context, unitID, ownerID uuid.UUID) ([]expense.Expense, error) {
	var list []expense.Expense
	for _, e := range m.expenses {
		if e.UnitID == unitID && e.OwnerID == ownerID && e.IsActive {
			list = append(list, *e)
		}
	}
	return list, nil
}

func (m *mockExpenseRepo) Update(_ context.Context, id, ownerID uuid.UUID, in expense.CreateExpenseInput) (*expense.Expense, error) {
	e, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	e.Description = in.Description
	e.Amount = in.Amount
	e.Category = in.Category
	return e, nil
}

func (m *mockExpenseRepo) ListByOwner(_ context.Context, ownerID uuid.UUID) ([]expense.Expense, error) {
	var list []expense.Expense
	for _, e := range m.expenses {
		if e.OwnerID == ownerID && e.IsActive {
			list = append(list, *e)
		}
	}
	return list, nil
}

func (m *mockExpenseRepo) Delete(_ context.Context, id, ownerID uuid.UUID) error {
	e, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return errors.New("not found")
	}
	e.IsActive = false
	return nil
}

func TestService_Create_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()
	unitID := uuid.New()

	e, err := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
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
	ownerID := uuid.New()

	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: uuid.New(), Description: "Luz", Amount: 100, DueDate: time.Now(), Category: "ELECTRICITY",
	})
	found, err := svc.Get(context.Background(), e.ID, ownerID)
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
	ownerID := uuid.New()
	unitID := uuid.New()

	svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Água", Amount: 100, DueDate: time.Now(), Category: "WATER",
	})
	svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Luz", Amount: 200, DueDate: time.Now(), Category: "ELECTRICITY",
	})

	list, err := svc.ListByUnit(context.Background(), unitID, ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestService_Update_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()

	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: uuid.New(), Description: "Original", Amount: 100, DueDate: time.Now(), Category: "OTHER",
	})
	updated, err := svc.Update(context.Background(), e.ID, ownerID, expense.CreateExpenseInput{
		UnitID: e.UnitID, Description: "Atualizado", Amount: 200, DueDate: time.Now(), Category: "MAINTENANCE",
	})
	require.NoError(t, err)
	assert.Equal(t, "Atualizado", updated.Description)
	assert.Equal(t, "MAINTENANCE", updated.Category)
}

func TestService_Delete(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	ownerID := uuid.New()
	unitID := uuid.New()

	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Para deletar", Amount: 50, DueDate: time.Now(), Category: "OTHER",
	})
	err := svc.Delete(context.Background(), e.ID, ownerID)
	require.NoError(t, err)

	list, _ := svc.ListByUnit(context.Background(), unitID, ownerID)
	assert.Len(t, list, 0)
}

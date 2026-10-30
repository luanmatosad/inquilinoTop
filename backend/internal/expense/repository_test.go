package expense_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, expenses, units, properties, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

// seedUnit cria organização, usuário, imóvel e unidade da organização.
func seedUnit(t *testing.T, database *db.DB) (userID, orgID, unitID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	suffix := uuid.New().String()[:8]

	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+suffix).Scan(&orgID))
	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, 'hash', $2) RETURNING id`,
		"expense-"+suffix+"@test.com", orgID).Scan(&userID))
	_, err := database.Pool.Exec(ctx,
		`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`, orgID, userID)
	require.NoError(t, err)

	var propertyID uuid.UUID
	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1, $2, 'RESIDENTIAL', 'Prédio') RETURNING id`,
		orgID, userID).Scan(&propertyID))
	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 1') RETURNING id`, propertyID).Scan(&unitID))
	return userID, orgID, unitID
}

func ymd(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

func newExpense(t *testing.T, repo expense.Repository, userID, orgID, unitID uuid.UUID, amount float64, due time.Time) *expense.Expense {
	t.Helper()
	e, err := repo.Create(context.Background(), userID, orgID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Conta", Amount: amount, DueDate: due, Category: "WATER",
	})
	require.NoError(t, err)
	return e
}

func TestExpenseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	userID, orgID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)

	e, err := repo.Create(context.Background(), userID, orgID, expense.CreateExpenseInput{
		UnitID:      unitID,
		Description: "Conta de água",
		Amount:      150.00,
		DueDate:     time.Now(),
		Category:    "WATER",
	})
	require.NoError(t, err)
	assert.Equal(t, "WATER", e.Category)
	assert.Equal(t, 150.00, e.Amount)
	assert.Equal(t, expense.StatusPending, e.Status, "nasce PENDING")
	assert.Nil(t, e.PaidDate)
	assert.Nil(t, e.PaidAmount)

	list, err := repo.ListByUnit(context.Background(), unitID, orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestExpenseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	userID, orgID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)

	e := newExpense(t, repo, userID, orgID, unitID, 200, time.Now())
	require.NoError(t, repo.Delete(context.Background(), e.ID, orgID))

	list, _ := repo.ListByUnit(context.Background(), unitID, orgID)
	assert.Len(t, list, 0)
}

func TestExpenseRepository_MarkPaidEUnpaid(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	userID, orgID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)
	e := newExpense(t, repo, userID, orgID, unitID, 100, ymd(2026, 6, 10))

	paid, err := repo.MarkPaid(ctx, e.ID, orgID, ymd(2026, 6, 9), 95.5)
	require.NoError(t, err)
	assert.Equal(t, expense.StatusPaid, paid.Status)
	assert.Equal(t, 95.5, *paid.PaidAmount)
	assert.True(t, paid.PaidDate.Equal(ymd(2026, 6, 9)))

	_, err = repo.MarkPaid(ctx, e.ID, orgID, ymd(2026, 6, 9), 95.5)
	assert.ErrorIs(t, err, expense.ErrAlreadyPaid)

	back, err := repo.MarkUnpaid(ctx, e.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, expense.StatusPending, back.Status)
	assert.Nil(t, back.PaidDate)
	assert.Nil(t, back.PaidAmount)

	_, err = repo.MarkUnpaid(ctx, e.ID, orgID)
	assert.ErrorIs(t, err, expense.ErrNotPaid)
}

func TestExpenseRepository_MarkPaid_OutraOrganização(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	userID, orgID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)
	e := newExpense(t, repo, userID, orgID, unitID, 100, ymd(2026, 6, 10))

	_, err := repo.MarkPaid(ctx, e.ID, uuid.New(), ymd(2026, 6, 9), 100)
	assert.Error(t, err, "não baixa despesa de outra organização")
	got, err := repo.GetByID(ctx, e.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, expense.StatusPending, got.Status)
}

func TestExpenseRepository_List_Filtros(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	userID, orgID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)
	today := ymd(2026, 6, 15)

	vencida := newExpense(t, repo, userID, orgID, unitID, 10, ymd(2026, 6, 1))
	hojeVence := newExpense(t, repo, userID, orgID, unitID, 20, today)
	futura := newExpense(t, repo, userID, orgID, unitID, 30, ymd(2026, 7, 1))
	paga := newExpense(t, repo, userID, orgID, unitID, 40, ymd(2026, 6, 5))
	_, err := repo.MarkPaid(ctx, paga.ID, orgID, ymd(2026, 6, 5), 40)
	require.NoError(t, err)

	ids := func(f expense.ListFilter) []uuid.UUID {
		list, err := repo.List(ctx, orgID, f, today)
		require.NoError(t, err)
		out := []uuid.UUID{}
		for _, e := range list {
			out = append(out, e.ID)
		}
		return out
	}

	assert.ElementsMatch(t, []uuid.UUID{vencida.ID, hojeVence.ID, futura.ID, paga.ID}, ids(expense.ListFilter{}))
	assert.ElementsMatch(t, []uuid.UUID{vencida.ID}, ids(expense.ListFilter{Status: expense.StatusLate}))
	assert.ElementsMatch(t, []uuid.UUID{hojeVence.ID, futura.ID}, ids(expense.ListFilter{Status: expense.StatusPending}), "vencendo hoje ainda é a vencer")
	assert.ElementsMatch(t, []uuid.UUID{paga.ID}, ids(expense.ListFilter{Status: expense.StatusPaid}))

	from, to := ymd(2026, 6, 5), ymd(2026, 6, 15)
	assert.ElementsMatch(t, []uuid.UUID{hojeVence.ID, paga.ID}, ids(expense.ListFilter{From: &from, To: &to}), "extremidades inclusivas")

	other := uuid.New()
	assert.Empty(t, ids(expense.ListFilter{UnitID: &other}))
	assert.Len(t, ids(expense.ListFilter{UnitID: &unitID}), 4)
}

func TestExpenseRepository_List_IsolaOrganização(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	userA, orgA, unitA := seedUnit(t, database)
	_, orgB, _ := seedUnit(t, database)
	repo := expense.NewRepository(database)
	newExpense(t, repo, userA, orgA, unitA, 10, ymd(2026, 6, 1))

	list, err := repo.List(ctx, orgB, expense.ListFilter{}, ymd(2026, 6, 15))
	require.NoError(t, err)
	assert.Empty(t, list)
}

func TestExpenseRepository_Summary(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	userID, orgID, unitID := seedUnit(t, database)
	repo := expense.NewRepository(database)
	today := ymd(2026, 6, 15)

	newExpense(t, repo, userID, orgID, unitID, 100, ymd(2026, 6, 20))
	newExpense(t, repo, userID, orgID, unitID, 50.5, ymd(2026, 7, 1))
	newExpense(t, repo, userID, orgID, unitID, 70, ymd(2026, 6, 1))
	paga := newExpense(t, repo, userID, orgID, unitID, 200, ymd(2026, 6, 3))
	_, err := repo.MarkPaid(ctx, paga.ID, orgID, ymd(2026, 6, 3), 190)
	require.NoError(t, err)

	got, err := repo.Summary(ctx, orgID, expense.ListFilter{}, today)
	require.NoError(t, err)
	assert.Equal(t, expense.Bucket{Count: 2, Total: 150.5}, got.ToPay)
	assert.Equal(t, expense.Bucket{Count: 1, Total: 70}, got.Overdue)
	assert.Equal(t, expense.Bucket{Count: 1, Total: 190}, got.Paid, "pago soma o valor efetivamente pago")

	from, to := ymd(2026, 6, 1), ymd(2026, 6, 30)
	got, err = repo.Summary(ctx, orgID, expense.ListFilter{From: &from, To: &to}, today)
	require.NoError(t, err)
	assert.Equal(t, 1, got.ToPay.Count)
	assert.Equal(t, 1, got.Overdue.Count)
	assert.Equal(t, 1, got.Paid.Count)
}

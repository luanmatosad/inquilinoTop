package payment_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/apierr"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, leases, tenants, units, properties, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedLease(t *testing.T, database *db.DB) (orgID, ownerID uuid.UUID, leaseID uuid.UUID) {
	t.Helper()

	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
		"Test Org "+uuid.New().String()[:8],
	).Scan(&newOrgID)
	require.NoError(t, err)

	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, $2, $3) RETURNING id`,
		"payment-"+uuid.New().String()[:8]+"@test.com", "hash", newOrgID,
	).Scan(&ownerID)
	require.NoError(t, err)

	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
		newOrgID, ownerID,
	)
	require.NoError(t, err)

	var propertyID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1, $2, 'RESIDENTIAL', 'Prédio') RETURNING id`,
		newOrgID, ownerID,
	).Scan(&propertyID)
	require.NoError(t, err)

	var unitID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 1') RETURNING id`,
		propertyID,
	).Scan(&unitID)
	require.NoError(t, err)

	var tenantID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (organization_id, owner_id, name) VALUES ($1, $2, 'Inquilino') RETURNING id`,
		newOrgID, ownerID,
	).Scan(&tenantID)
	require.NoError(t, err)

	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO leases (organization_id, owner_id, unit_id, tenant_id, start_date, rent_amount)
		 VALUES ($1, $2, $3, $4, NOW(), 1000) RETURNING id`,
		newOrgID, ownerID, unitID, tenantID,
	).Scan(&leaseID)
	require.NoError(t, err)

	return newOrgID, ownerID, leaseID
}

func TestPaymentRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)

	p, err := repo.Create(context.Background(), ownerID, orgID, payment.CreatePaymentInput{
		LeaseID:     leaseID,
		DueDate:     time.Now(),
		GrossAmount: 1000.00,
		Type:        "RENT",
	})
	require.NoError(t, err)
	assert.Equal(t, "PENDING", p.Status)
	assert.Equal(t, "RENT", p.Type)

	list, err := repo.ListByLease(context.Background(), leaseID, orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestPaymentRepository_Update_MarkAsPaid(t *testing.T) {
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)

	p, err := repo.Create(context.Background(), ownerID, orgID, payment.CreatePaymentInput{
		LeaseID:     leaseID,
		DueDate:     time.Now(),
		GrossAmount: 1000,
		Type:        "RENT",
	})
	require.NoError(t, err)
	require.NotNil(t, p)

	paidDate := time.Now()
	p, err = repo.Update(context.Background(), p.ID, orgID, payment.UpdatePaymentInput{
		Status:      "PAID",
		PaidDate:    &paidDate,
		GrossAmount: 1000,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", p.Status)
	assert.NotNil(t, p.PaidDate)
}

func TestFinancialRepository_DeleteFinancialConfig_SoftDelete(t *testing.T) {
	database := testDB(t)
	repo := payment.NewRepository(database)

	var orgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
		"Test Org "+uuid.New().String()[:8],
	).Scan(&orgID)
	require.NoError(t, err)

	var ownerID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, $2, $3) RETURNING id`,
		"fc-"+uuid.New().String()[:8]+"@test.com", "hash", orgID,
	).Scan(&ownerID)
	require.NoError(t, err)

	cfg, err := repo.CreateFinancialConfig(context.Background(), orgID, payment.CreateFinancialConfigInput{
		Provider: "MOCK",
		Config:   map[string]any{"token": "123"},
	})
	require.NoError(t, err)
	require.NotNil(t, cfg)

	paidDate := time.Now()
	err = repo.DeleteFinancialConfig(context.Background(), cfg.ID, orgID)
	require.NoError(t, err)

	var count int
	err = database.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM financial_config WHERE id=$1`, cfg.ID,
	).Scan(&count)
	require.NoError(t, err)
	assert.Equal(t, 1, count, "soft-delete não deve remover o registro do banco")

	var isActive bool
	err = database.Pool.QueryRow(context.Background(),
		`SELECT is_active FROM financial_config WHERE id=$1`, cfg.ID,
	).Scan(&isActive)
	require.NoError(t, err)
	assert.False(t, isActive, "is_active deve ser false após soft-delete")

	_ = paidDate
}

func TestRepository_CreateIfAbsent_Idempotente(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	orgID, ownerID, leaseID := seedLease(t, d)

	comp := "2026-04"
	in := payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
		Competency: &comp,
	}
	p1, created, err := repo.CreateIfAbsent(context.Background(), ownerID, orgID, in)
	require.NoError(t, err)
	require.True(t, created)
	require.NotNil(t, p1)

	p2, created, err := repo.CreateIfAbsent(context.Background(), ownerID, orgID, in)
	require.NoError(t, err)
	assert.False(t, created)
	assert.Equal(t, p1.ID, p2.ID)
}

func TestRepository_MarkPaid_PersisteCamposDerivados(t *testing.T) {
	d := testDB(t)
	repo := payment.NewRepository(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(context.Background(), ownerID, orgID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 2000, Type: "RENT",
	})
	require.NoError(t, err)

	paid, err := repo.MarkPaid(context.Background(), p.ID, orgID, time.Now(),
		200, 30, 150, 2080)
	require.NoError(t, err)
	assert.Equal(t, "PAID", paid.Status)
	assert.InDelta(t, 200, paid.LateFeeAmount, 0.01)
	assert.InDelta(t, 30, paid.InterestAmount, 0.01)
	assert.InDelta(t, 150, paid.IRRFAmount, 0.01)
	require.NotNil(t, paid.NetAmount)
	assert.InDelta(t, 2080, *paid.NetAmount, 0.01)
}

func TestPaymentRepository_DeactivateFuturePending(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)
	today := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)

	mk := func(due time.Time, comp string) *payment.Payment {
		p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{
			LeaseID: leaseID, DueDate: due, GrossAmount: 1000, Type: "RENT", Competency: &comp,
		})
		require.NoError(t, err)
		return p
	}
	past := mk(today.AddDate(0, -1, 0), "2026-05")
	future := mk(today.AddDate(0, 1, 0), "2026-07")
	charged := mk(today.AddDate(0, 2, 0), "2026-08")
	paid := mk(today.AddDate(0, 3, 0), "2026-09")

	require.NoError(t, repo.UpdateChargeInfo(ctx, charged.ID, orgID, payment.UpdateChargeInfoInput{ChargeID: "ch_1", ChargeMethod: "PIX"}))
	paidDate := today
	_, err := repo.Update(ctx, paid.ID, orgID, payment.UpdatePaymentInput{Status: "PAID", PaidDate: &paidDate, GrossAmount: 1000})
	require.NoError(t, err)

	res, err := repo.DeactivateFuturePending(ctx, leaseID, orgID, today)
	require.NoError(t, err)
	assert.Equal(t, 1, res.Deactivated)
	assert.Equal(t, 1, res.NeedsReview, "futura pendente com cobrança emitida fica para decisão manual")

	_, err = repo.GetByID(ctx, future.ID, orgID)
	assert.ErrorIs(t, err, apierr.ErrNotFound)

	list, err := repo.ListByLease(ctx, leaseID, orgID)
	require.NoError(t, err)
	ids := []uuid.UUID{}
	for _, p := range list {
		ids = append(ids, p.ID)
	}
	assert.ElementsMatch(t, []uuid.UUID{past.ID, charged.ID, paid.ID}, ids)

	// idempotente
	res, err = repo.DeactivateFuturePending(ctx, leaseID, orgID, today)
	require.NoError(t, err)
	assert.Equal(t, 0, res.Deactivated)
}

func TestPaymentRepository_DeactivateFuturePending_OutraOrganização(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)
	comp := "2099-01"
	_, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now().AddDate(1, 0, 0), GrossAmount: 1000, Type: "RENT", Competency: &comp,
	})
	require.NoError(t, err)

	res, err := repo.DeactivateFuturePending(ctx, leaseID, uuid.New(), time.Now())
	require.NoError(t, err)
	assert.Equal(t, 0, res.Deactivated)
}

func TestPaymentRepository_List_Filtros(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)
	today := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)

	mk := func(due time.Time, comp string) *payment.Payment {
		p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{
			LeaseID: leaseID, DueDate: due, GrossAmount: 1000, Type: "RENT", Competency: &comp,
		})
		require.NoError(t, err)
		return p
	}
	vencida := mk(today.AddDate(0, 0, -10), "2026-04")
	hoje := mk(today, "2026-06")
	futura := mk(today.AddDate(0, 1, 0), "2026-07")
	paga := mk(today.AddDate(0, -1, 0), "2026-05")
	paidDate := today
	_, err := repo.Update(ctx, paga.ID, orgID, payment.UpdatePaymentInput{Status: "PAID", PaidDate: &paidDate, GrossAmount: 1000})
	require.NoError(t, err)

	ids := func(f payment.PaymentFilter) []uuid.UUID {
		list, err := repo.List(ctx, orgID, f, today)
		require.NoError(t, err)
		out := []uuid.UUID{}
		for _, p := range list {
			out = append(out, p.ID)
		}
		return out
	}
	assert.Len(t, ids(payment.PaymentFilter{}), 4)
	assert.ElementsMatch(t, []uuid.UUID{vencida.ID}, ids(payment.PaymentFilter{Status: "LATE"}))
	assert.ElementsMatch(t, []uuid.UUID{hoje.ID, futura.ID}, ids(payment.PaymentFilter{Status: "PENDING"}))
	assert.ElementsMatch(t, []uuid.UUID{paga.ID}, ids(payment.PaymentFilter{Status: "PAID"}))

	from, to := today.AddDate(0, 0, -10), today
	assert.ElementsMatch(t, []uuid.UUID{vencida.ID, hoje.ID}, ids(payment.PaymentFilter{From: &from, To: &to}), "extremidades inclusivas")

	other := uuid.New()
	assert.Empty(t, ids(payment.PaymentFilter{LeaseID: &other}))
	assert.Len(t, ids(payment.PaymentFilter{LeaseID: &leaseID}), 4)

	empty, err := repo.List(ctx, uuid.New(), payment.PaymentFilter{}, today)
	require.NoError(t, err)
	assert.Empty(t, empty, "isolamento por organização")
}

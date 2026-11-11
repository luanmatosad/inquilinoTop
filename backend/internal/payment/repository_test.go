package payment_test

import (
	"context"
	"os"
	"strings"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, financial_config, leases, tenants, units, properties, organizations, users RESTART IDENTITY CASCADE")
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

	paid, err := repo.MarkPaid(context.Background(), p.ID, orgID, payment.PaidInput{
		PaidDate: time.Now(), LateFee: 200, Interest: 30, IRRF: 150, Net: 2080,
	})
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

func newOrg(t *testing.T, database *db.DB) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+uuid.New().String()[:8]).Scan(&id))
	return id
}

func TestFinancialRepository_Upsert_UmaConfigAtivaPorOrganização(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	repo := payment.NewRepository(database)
	orgA, orgB := newOrg(t, database), newOrg(t, database)

	first, err := repo.UpsertFinancialConfig(ctx, orgA, payment.UpsertFinancialConfigInput{Provider: "MOCK", Config: map[string]any{"token": "1"}})
	require.NoError(t, err)
	assert.Equal(t, orgA, first.OrganizationID)

	second, err := repo.UpsertFinancialConfig(ctx, orgA, payment.UpsertFinancialConfigInput{Provider: "ASAAS", Config: map[string]any{"token": "2"}})
	require.NoError(t, err)
	assert.Equal(t, first.ID, second.ID, "segundo upsert atualiza a mesma linha")
	assert.Equal(t, "ASAAS", second.Provider)

	other, err := repo.UpsertFinancialConfig(ctx, orgB, payment.UpsertFinancialConfigInput{Provider: "MOCK", Config: map[string]any{}})
	require.NoError(t, err)
	assert.NotEqual(t, first.ID, other.ID)

	got, err := repo.GetActiveFinancialConfig(ctx, orgA)
	require.NoError(t, err)
	assert.Equal(t, first.ID, got.ID)
	assert.Equal(t, "ASAAS", got.Provider)

	_, err = repo.GetFinancialConfig(ctx, orgB)
	assert.NoError(t, err)
}

func TestFinancialRepository_Isolamento(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	repo := payment.NewRepository(database)
	orgA := newOrg(t, database)
	cfg, err := repo.CreateFinancialConfig(ctx, orgA, payment.CreateFinancialConfigInput{Provider: "MOCK", Config: map[string]any{}})
	require.NoError(t, err)

	err = repo.DeleteFinancialConfig(ctx, cfg.ID, uuid.New())
	assert.Error(t, err, "outra organização não desativa a configuração")
	got, err := repo.GetActiveFinancialConfig(ctx, orgA)
	require.NoError(t, err)
	assert.Equal(t, cfg.ID, got.ID)
}

func TestPaymentRepository_UpdateFuturePendingRent(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)
	from := time.Date(2026, 6, 5, 0, 0, 0, 0, time.UTC)

	mk := func(due time.Time, comp, typ string) *payment.Payment {
		c := comp
		p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{
			LeaseID: leaseID, DueDate: due, GrossAmount: 1000, Type: typ, Competency: &c,
		})
		require.NoError(t, err)
		return p
	}
	antes := mk(from.AddDate(0, -1, 0), "2026-05", "RENT")   // vencimento antes da vigência
	naData := mk(from, "2026-06", "RENT")                    // exatamente na vigência: entra
	futura := mk(from.AddDate(0, 1, 0), "2026-07", "RENT")   // entra
	emitida := mk(from.AddDate(0, 2, 0), "2026-08", "RENT")  // com cobrança emitida: não muda, vira revisão
	paga := mk(from.AddDate(0, 3, 0), "2026-09", "RENT")     // paga: não muda
	iptu := mk(from.AddDate(0, 1, 0), "2026-07", "EXPENSE")  // IPTU: não muda
	retirada := mk(from.AddDate(0, 4, 0), "2026-10", "RENT") // desativada: não muda

	require.NoError(t, repo.UpdateChargeInfo(ctx, emitida.ID, orgID, payment.UpdateChargeInfoInput{ChargeID: "ch_1", ChargeMethod: "PIX"}))
	paidDate := from
	_, err := repo.Update(ctx, paga.ID, orgID, payment.UpdatePaymentInput{Status: "PAID", PaidDate: &paidDate, GrossAmount: 1000})
	require.NoError(t, err)
	_, err = repo.DeactivateFuturePending(ctx, leaseID, orgID, from.AddDate(0, 3, 15))
	require.NoError(t, err)

	res, err := repo.UpdateFuturePendingRent(ctx, leaseID, orgID, from, 1100)
	require.NoError(t, err)
	assert.Equal(t, 2, res.Updated, "só a da vigência e a futura sem cobrança emitida")
	assert.Equal(t, 1, res.NeedsReview, "a futura com cobrança emitida fica para revisão")

	gross := func(id uuid.UUID) float64 {
		var v float64
		require.NoError(t, database.Pool.QueryRow(ctx, `SELECT gross_amount FROM payments WHERE id=$1`, id).Scan(&v))
		return v
	}
	assert.Equal(t, 1000.0, gross(antes.ID), "antes da vigência não muda")
	assert.Equal(t, 1100.0, gross(naData.ID), "o vencimento igual à vigência entra")
	assert.Equal(t, 1100.0, gross(futura.ID))
	assert.Equal(t, 1000.0, gross(emitida.ID), "cobrança emitida não muda")
	assert.Equal(t, 1000.0, gross(paga.ID), "paga não muda")
	assert.Equal(t, 1000.0, gross(iptu.ID), "IPTU (EXPENSE) não muda")
	assert.Equal(t, 1000.0, gross(retirada.ID), "retirada da cobrança (is_active=false) não muda")

	// idempotente: repetir com o mesmo valor não altera nada além do que já foi atualizado
	res, err = repo.UpdateFuturePendingRent(ctx, leaseID, orgID, from, 1100)
	require.NoError(t, err)
	assert.Equal(t, 2, res.Updated)
	assert.Equal(t, 1100.0, gross(futura.ID))
}

func TestPaymentRepository_UpdateFuturePendingRent_OutraOrganizacao(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)
	from := time.Date(2026, 6, 5, 0, 0, 0, 0, time.UTC)
	comp := "2026-07"
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: from.AddDate(0, 1, 0), GrossAmount: 1000, Type: "RENT", Competency: &comp,
	})
	require.NoError(t, err)

	res, err := repo.UpdateFuturePendingRent(ctx, leaseID, uuid.New(), from, 1100)
	require.NoError(t, err)
	assert.Equal(t, 0, res.Updated)

	var v float64
	require.NoError(t, database.Pool.QueryRow(ctx, `SELECT gross_amount FROM payments WHERE id=$1`, p.ID).Scan(&v))
	assert.Equal(t, 1000.0, v)
}

func TestRepository_Eventos_GravaEListaPorOrganização(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	store := payment.NewEventStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT"})
	require.NoError(t, err)

	ch := "WHATSAPP"
	e1, err := store.AddEvent(ctx, orgID, p.ID, &ownerID, "SENT", &ch, map[string]any{"reminder": false})
	require.NoError(t, err)
	assert.Equal(t, "SENT", e1.Kind)
	require.NotNil(t, e1.Channel)
	_, err = store.AddEvent(ctx, orgID, p.ID, &ownerID, "REMINDER", &ch, nil)
	require.NoError(t, err)

	list, err := store.ListEvents(ctx, p.ID, orgID)
	require.NoError(t, err)
	require.Len(t, list, 2)
	assert.Equal(t, "SENT", list[0].Kind)
	assert.Equal(t, "REMINDER", list[1].Kind)
	require.NotNil(t, list[0].ActorID)
	assert.Equal(t, ownerID, *list[0].ActorID)

	other, err := store.ListEvents(ctx, p.ID, uuid.New())
	require.NoError(t, err)
	assert.Empty(t, other, "outra organização não vê os eventos")
}

func TestRepository_Eventos_KindInválidoRecusadoPeloBanco(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	store := payment.NewEventStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT"})
	require.NoError(t, err)
	_, err = store.AddEvent(ctx, orgID, p.ID, &ownerID, "DELETED", nil, nil)
	assert.Error(t, err)
}

func TestMigration049_ColunasETabelas(t *testing.T) {
	d := testDB(t)
	for _, q := range []string{
		`SELECT 1 FROM payment_events LIMIT 0`,
		`SELECT 1 FROM receipt_counters LIMIT 0`,
		`SELECT payment_method, discount_amount, payment_note, original_due_date, receipt_number, receipt_year FROM payments LIMIT 0`,
	} {
		_, err := d.Pool.Exec(context.Background(), q)
		assert.NoError(t, err, q)
	}
}

func TestRepository_MarkPaid_GravaFormaDescontoNúmeroEEvento(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	store := payment.NewEventStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1850, Type: "RENT"})
	require.NoError(t, err)

	method, note := "CASH", "portaria"
	paidDate := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	paid, err := repo.MarkPaid(ctx, p.ID, orgID, payment.PaidInput{
		PaidDate: paidDate, Net: 1800, Discount: 50, Method: &method, Note: &note, ActorID: &ownerID,
	})
	require.NoError(t, err)
	assert.Equal(t, "PAID", paid.Status)
	assert.Equal(t, 50.0, paid.DiscountAmount)
	assert.Equal(t, "CASH", *paid.PaymentMethod)
	assert.Equal(t, "portaria", *paid.PaymentNote)
	require.NotNil(t, paid.ReceiptNumber)
	assert.Equal(t, 1, *paid.ReceiptNumber)
	assert.Equal(t, 2026, *paid.ReceiptYear)

	evs, err := store.ListEvents(ctx, p.ID, orgID)
	require.NoError(t, err)
	require.Len(t, evs, 1)
	assert.Equal(t, "PAID", evs[0].Kind)
	assert.Equal(t, 1800.0, evs[0].Data["amount"])
	assert.Equal(t, "CASH", evs[0].Data["method"])
}

func TestRepository_MarkPaid_NumeraçãoPorAno(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	mk := func(comp string) *payment.Payment {
		p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT", Competency: &comp})
		require.NoError(t, err)
		return p
	}
	a, b, c := mk("2026-11"), mk("2026-12"), mk("2027-01")
	pa, err := repo.MarkPaid(ctx, a.ID, orgID, payment.PaidInput{PaidDate: time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), Net: 1000})
	require.NoError(t, err)
	pb, err := repo.MarkPaid(ctx, b.ID, orgID, payment.PaidInput{PaidDate: time.Date(2026, 12, 2, 0, 0, 0, 0, time.UTC), Net: 1000})
	require.NoError(t, err)
	pc, err := repo.MarkPaid(ctx, c.ID, orgID, payment.PaidInput{PaidDate: time.Date(2027, 1, 2, 0, 0, 0, 0, time.UTC), Net: 1000})
	require.NoError(t, err)
	assert.Equal(t, []int{1, 2, 1}, []int{*pa.ReceiptNumber, *pb.ReceiptNumber, *pc.ReceiptNumber})
}

func TestRepository_MarkPaid_CorridaGeraNúmerosDistintos(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	const n = 8
	ids := make([]uuid.UUID, n)
	for i := range ids {
		comp := time.Date(2026, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC).Format("2006-01")
		p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT", Competency: &comp})
		require.NoError(t, err)
		ids[i] = p.ID
	}
	numbers := make(chan int, n)
	errs := make(chan error, n)
	for _, id := range ids {
		go func(id uuid.UUID) {
			p, err := repo.MarkPaid(ctx, id, orgID, payment.PaidInput{PaidDate: time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), Net: 1000})
			if err != nil {
				errs <- err
				return
			}
			numbers <- *p.ReceiptNumber
		}(id)
	}
	seen := map[int]bool{}
	for i := 0; i < n; i++ {
		select {
		case e := <-errs:
			t.Fatal(e)
		case v := <-numbers:
			assert.False(t, seen[v], "número %d repetido", v)
			seen[v] = true
		}
	}
	assert.Len(t, seen, n)
}

func TestRepository_EnsureReceiptNumber_PagaAntigaEOutraOrganização(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT"})
	require.NoError(t, err)
	paidDate := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	// caminho antigo: status e data pelo Update, sem número
	_, err = repo.Update(ctx, p.ID, orgID, payment.UpdatePaymentInput{Status: "PAID", PaidDate: &paidDate, GrossAmount: 1000})
	require.NoError(t, err)

	first, err := repo.EnsureReceiptNumber(ctx, p.ID, orgID)
	require.NoError(t, err)
	require.NotNil(t, first.ReceiptNumber)
	assert.Equal(t, 1, *first.ReceiptNumber)
	assert.Equal(t, 2026, *first.ReceiptYear)
	again, err := repo.EnsureReceiptNumber(ctx, p.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, *first.ReceiptNumber, *again.ReceiptNumber)

	_, err = repo.EnsureReceiptNumber(ctx, p.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestRepository_ApplyAgreement_AtualizaPreservaOriginalEGravaEvento(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	store := payment.NewEventStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	due := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: due, GrossAmount: 1550, Type: "RENT"})
	require.NoError(t, err)

	note := "combinado"
	nov12 := time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)
	out, err := repo.ApplyAgreement(ctx, p.ID, orgID, payment.AgreementApply{
		NewDueDate: nov12, NewGross: 1585.13, OldDueDate: due, OldGross: 1550, Note: &note, ActorID: &ownerID,
	})
	require.NoError(t, err)
	assert.True(t, out.DueDate.Equal(nov12))
	assert.InDelta(t, 1585.13, out.GrossAmount, 0.001)
	require.NotNil(t, out.OriginalDueDate)
	assert.True(t, out.OriginalDueDate.Equal(due))

	// segundo acordo: o vencimento original continua o primeiro
	dec := time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC)
	out, err = repo.ApplyAgreement(ctx, p.ID, orgID, payment.AgreementApply{NewDueDate: dec, NewGross: 1585.13, OldDueDate: nov12, OldGross: 1585.13})
	require.NoError(t, err)
	assert.True(t, out.OriginalDueDate.Equal(due), "original preservado na primeira vez")

	evs, err := store.ListEvents(ctx, p.ID, orgID)
	require.NoError(t, err)
	require.Len(t, evs, 2)
	assert.Equal(t, "AGREEMENT", evs[0].Kind)
	assert.Equal(t, "2026-10-30", evs[0].Data["old_due_date"])
	assert.Equal(t, "2026-11-12", evs[0].Data["new_due_date"])
	assert.Equal(t, 1550.0, evs[0].Data["old_amount"])
	assert.Equal(t, 1585.13, evs[0].Data["new_amount"])
	assert.Equal(t, "combinado", evs[0].Data["note"])
}

func TestRepository_ApplyAgreement_PagaEOutraOrganizaçãoNãoMudam(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	due := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: due, GrossAmount: 1550, Type: "RENT"})
	require.NoError(t, err)
	ap := payment.AgreementApply{NewDueDate: due.AddDate(0, 0, 14), NewGross: 1600, OldDueDate: due, OldGross: 1550}

	_, err = repo.ApplyAgreement(ctx, p.ID, uuid.New(), ap)
	assert.ErrorIs(t, err, apierr.ErrNotFound)

	_, err = repo.MarkPaid(ctx, p.ID, orgID, payment.PaidInput{PaidDate: time.Now(), Net: 1550})
	require.NoError(t, err)
	_, err = repo.ApplyAgreement(ctx, p.ID, orgID, ap)
	assert.ErrorIs(t, err, apierr.ErrNotFound, "paga não aceita acordo")
}

func TestRepository_Links_UmAtivoPorCobrançaEHashÚnico(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	links := payment.NewLinkStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT"})
	require.NoError(t, err)

	exp := time.Now().Add(48 * time.Hour)
	h1 := strings.Repeat("a", 64)
	h2 := strings.Repeat("b", 64)
	require.NoError(t, links.RotateLink(ctx, orgID, p.ID, &ownerID, h1, exp))
	require.NoError(t, links.RotateLink(ctx, orgID, p.ID, &ownerID, h2, exp))

	first, err := links.GetLinkByHash(ctx, h1)
	require.NoError(t, err)
	assert.NotNil(t, first.RevokedAt, "o link anterior foi revogado")
	second, err := links.GetLinkByHash(ctx, h2)
	require.NoError(t, err)
	assert.Nil(t, second.RevokedAt)
	assert.Equal(t, p.ID, second.PaymentID)
	assert.Equal(t, orgID, second.OrganizationID)

	_, err = links.GetLinkByHash(ctx, strings.Repeat("c", 64))
	assert.ErrorIs(t, err, apierr.ErrNotFound)

	other := uuid.New()
	assert.Error(t, links.RotateLink(ctx, other, p.ID, nil, strings.Repeat("d", 64), exp), "organização que não é dona da cobrança")
}

func TestRepository_Report_SalvaLimpaEGravaEventos(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	reports := payment.NewReportStore(d)
	store := payment.NewEventStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	p, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT"})
	require.NoError(t, err)

	proof := "org/comp.png"
	old, err := reports.SaveReport(ctx, orgID, p.ID, payment.ReportApply{Amount: 1000, PaidDate: time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), ProofPath: &proof})
	require.NoError(t, err)
	assert.Nil(t, old)

	got, err := repo.GetByID(ctx, p.ID, orgID)
	require.NoError(t, err)
	require.NotNil(t, got.ReportedAt)
	assert.Equal(t, 1000.0, *got.ReportedAmount)
	assert.Equal(t, "2026-11-02", got.ReportedDate.Format("2006-01-02"))
	require.NotNil(t, got.ProofPath)
	assert.Equal(t, "PENDING", got.Status)

	proof2 := "org/comp2.pdf"
	old, err = reports.SaveReport(ctx, orgID, p.ID, payment.ReportApply{Amount: 990, PaidDate: time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC), ProofPath: &proof2})
	require.NoError(t, err)
	require.NotNil(t, old)
	assert.Equal(t, proof, *old)

	old, err = reports.ClearReport(ctx, orgID, p.ID, &ownerID)
	require.NoError(t, err)
	assert.Equal(t, proof2, *old)
	got, err = repo.GetByID(ctx, p.ID, orgID)
	require.NoError(t, err)
	assert.Nil(t, got.ReportedAt)
	assert.Nil(t, got.ProofPath)

	evs, err := store.ListEvents(ctx, p.ID, orgID)
	require.NoError(t, err)
	kinds := []string{}
	for _, e := range evs {
		kinds = append(kinds, e.Kind)
	}
	assert.Equal(t, []string{"REPORTED", "REPORTED", "REJECTED"}, kinds)

	_, err = reports.SaveReport(ctx, uuid.New(), p.ID, payment.ReportApply{Amount: 1, PaidDate: time.Now()})
	assert.ErrorIs(t, err, apierr.ErrNotFound, "outra organização")
}

func TestPaymentRepository_List_FiltroAguardandoConfirmação(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	repo := payment.NewRepository(d)
	reports := payment.NewReportStore(d)
	orgID, ownerID, leaseID := seedLease(t, d)
	today := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
	a, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: today.AddDate(0, 0, 3), GrossAmount: 1000, Type: "RENT", Competency: strptr("2026-11")})
	require.NoError(t, err)
	_, err = repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{LeaseID: leaseID, DueDate: today.AddDate(0, 0, 3), GrossAmount: 500, Type: "OTHER"})
	require.NoError(t, err)
	_, err = reports.SaveReport(ctx, orgID, a.ID, payment.ReportApply{Amount: 1000, PaidDate: today})
	require.NoError(t, err)

	list, err := repo.List(ctx, orgID, payment.PaymentFilter{Status: "AWAITING_CONFIRMATION"}, today)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, a.ID, list[0].ID)
}

func TestPaymentRepository_List_ExpoeNomeDoInquilino(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID, leaseID := seedLease(t, database)
	repo := payment.NewRepository(database)
	today := time.Date(2026, 6, 15, 0, 0, 0, 0, time.UTC)

	_, err := repo.Create(ctx, ownerID, orgID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: today, GrossAmount: 1000, Type: "RENT",
	})
	require.NoError(t, err)

	list, err := repo.List(ctx, orgID, payment.PaymentFilter{}, today)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.NotNil(t, list[0].TenantName)
	assert.Equal(t, "Inquilino", *list[0].TenantName)
}

func strptr(s string) *string { return &s }

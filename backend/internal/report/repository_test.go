package report_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/report"
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
		d.Pool.Exec(context.Background(), "TRUNCATE expenses, payments, leases, tenants, units, properties, organization_members, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

type world struct {
	org, owner uuid.UUID
	propertyID uuid.UUID
}

func seedWorld(t *testing.T, d *db.DB) world {
	t.Helper()
	ctx := context.Background()
	w := world{}
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+uuid.NewString()[:8]).Scan(&w.org))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1,'hash',$2) RETURNING id`,
		"rep-"+uuid.NewString()[:8]+"@test.com", w.org).Scan(&w.owner))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1,$2,'RESIDENTIAL','Prédio') RETURNING id`,
		w.org, w.owner).Scan(&w.propertyID))
	return w
}

// unitWithLease cria uma unidade com contrato e devolve (unitID, leaseID).
func (w world) unitWithLease(t *testing.T, d *db.DB, label string) (uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	var unit, tenant, lease uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO units (property_id, label) VALUES ($1,$2) RETURNING id`, w.propertyID, label).Scan(&unit))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO tenants (organization_id, owner_id, name) VALUES ($1,$2,'T') RETURNING id`, w.org, w.owner).Scan(&tenant))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO leases (organization_id, owner_id, unit_id, tenant_id, start_date, rent_amount) VALUES ($1,$2,$3,$4,'2025-01-01',1000) RETURNING id`,
		w.org, w.owner, unit, tenant).Scan(&lease))
	return unit, lease
}

func (w world) payment(t *testing.T, d *db.DB, lease uuid.UUID, typ, status string, paid *string, gross float64, net *float64) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO payments (organization_id, owner_id, lease_id, due_date, gross_amount, type, status, paid_date, net_amount)
		 VALUES ($1,$2,$3,'2026-01-05',$4,$5,$6,$7::date,$8)`, w.org, w.owner, lease, gross, typ, status, paid, net)
	require.NoError(t, err)
}

func (w world) expense(t *testing.T, d *db.DB, unit uuid.UUID, paid *string, amount float64) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO expenses (organization_id, owner_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount)
		 VALUES ($1,$2,$3,'d',$4::float8,'2026-01-05','CONDO', CASE WHEN $5::date IS NULL THEN 'PENDING' ELSE 'PAID' END, $5::date, CASE WHEN $5::date IS NULL THEN NULL ELSE $4::float8 END)`,
		w.org, w.owner, unit, amount, paid)
	require.NoError(t, err)
}

func s(v string) *string   { return &v }
func f(v float64) *float64 { return &v }

var (
	jan1  = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	oct31 = time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC)
)

func TestRepository_MonthlyReceived(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	w := seedWorld(t, d)
	_, lease := w.unitWithLease(t, d, "Ap 1")

	w.payment(t, d, lease, "RENT", "PAID", s("2026-09-30"), 1000, f(980))     // líquido
	w.payment(t, d, lease, "RENT", "PAID", s("2026-09-02"), 500, nil)         // sem líquido: bruto
	w.payment(t, d, lease, "RENT", "PAID", s("2026-10-31"), 700, f(700))      // último dia entra
	w.payment(t, d, lease, "RENT", "PAID", s("2026-11-01"), 999, f(999))      // fora do período
	w.payment(t, d, lease, "RENT", "PAID", s("2025-12-31"), 999, f(999))      // fora do período
	w.payment(t, d, lease, "DEPOSIT", "PAID", s("2026-09-10"), 5000, f(5000)) // não é aluguel
	w.payment(t, d, lease, "RENT", "PENDING", nil, 1000, nil)                 // não paga

	got, err := repo.MonthlyReceived(context.Background(), w.org, jan1, oct31)
	require.NoError(t, err)
	byMonth := map[string]report.MonthAmount{}
	for _, m := range got {
		byMonth[m.Month] = m
	}
	assert.Equal(t, 1480.0, byMonth["2026-09"].Total)
	assert.Equal(t, 2, byMonth["2026-09"].Count)
	assert.Equal(t, 700.0, byMonth["2026-10"].Total)
	assert.Len(t, byMonth, 2)
}

func TestRepository_MonthlyExpenses(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	w := seedWorld(t, d)
	unit, _ := w.unitWithLease(t, d, "Ap 1")
	w.expense(t, d, unit, s("2026-03-10"), 300)
	w.expense(t, d, unit, s("2026-03-20"), 100)
	w.expense(t, d, unit, nil, 999)             // pendente não entra
	w.expense(t, d, unit, s("2026-11-02"), 999) // fora

	got, err := repo.MonthlyExpenses(context.Background(), w.org, jan1, oct31)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "2026-03", got[0].Month)
	assert.Equal(t, 400.0, got[0].Total)
}

func TestRepository_PorUnidade(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	w := seedWorld(t, d)
	u1, l1 := w.unitWithLease(t, d, "Ap 1")
	u2, l2 := w.unitWithLease(t, d, "Ap 2")
	w.payment(t, d, l1, "RENT", "PAID", s("2026-02-05"), 1850, f(1850))
	w.payment(t, d, l1, "RENT", "PAID", s("2026-03-05"), 1850, f(1850))
	w.payment(t, d, l2, "RENT", "PAID", s("2026-02-05"), 1000, f(1000))
	w.expense(t, d, u1, s("2026-02-10"), 300)

	recv, err := repo.UnitReceived(context.Background(), w.org, jan1, oct31)
	require.NoError(t, err)
	got := map[uuid.UUID]float64{}
	for _, r := range recv {
		got[r.UnitID] = r.Total
	}
	assert.Equal(t, 3700.0, got[u1])
	assert.Equal(t, 1000.0, got[u2])

	exp, err := repo.UnitExpenses(context.Background(), w.org, jan1, oct31)
	require.NoError(t, err)
	require.Len(t, exp, 1)
	assert.Equal(t, u1, exp[0].UnitID)
	assert.Equal(t, 300.0, exp[0].Total)
}

func TestRepository_IsolamentoPorOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	a := seedWorld(t, d)
	b := seedWorld(t, d)
	ua, la := a.unitWithLease(t, d, "Ap A")
	a.payment(t, d, la, "RENT", "PAID", s("2026-02-05"), 1000, f(1000))
	a.expense(t, d, ua, s("2026-02-05"), 100)

	for name, call := range map[string]func() (int, error){
		"recebido": func() (int, error) {
			r, e := repo.MonthlyReceived(context.Background(), b.org, jan1, oct31)
			return len(r), e
		},
		"despesas": func() (int, error) {
			r, e := repo.MonthlyExpenses(context.Background(), b.org, jan1, oct31)
			return len(r), e
		},
		"recebido/unid.": func() (int, error) {
			r, e := repo.UnitReceived(context.Background(), b.org, jan1, oct31)
			return len(r), e
		},
		"despesas/unid.": func() (int, error) {
			r, e := repo.UnitExpenses(context.Background(), b.org, jan1, oct31)
			return len(r), e
		},
	} {
		n, err := call()
		require.NoError(t, err, name)
		assert.Equal(t, 0, n, name)
	}
}

// leaseFor cria unidade, inquilino (com tipo e nome) e contrato.
func (w world) leaseFor(t *testing.T, d *db.DB, label, name, personType string) (uuid.UUID, uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	var unit, tenant, lease uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO units (property_id, label) VALUES ($1,$2) RETURNING id`, w.propertyID, label).Scan(&unit))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO tenants (organization_id, owner_id, name, person_type) VALUES ($1,$2,$3,$4) RETURNING id`, w.org, w.owner, name, personType).Scan(&tenant))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO leases (organization_id, owner_id, unit_id, tenant_id, start_date, rent_amount) VALUES ($1,$2,$3,$4,'2025-01-01',1000) RETURNING id`,
		w.org, w.owner, unit, tenant).Scan(&lease))
	return unit, lease
}

func (w world) expenseIn(t *testing.T, d *db.DB, unit uuid.UUID, category, desc string, paid *string, amount float64) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO expenses (organization_id, owner_id, unit_id, description, amount, due_date, category, status, paid_date, paid_amount)
		 VALUES ($1,$2,$3,$4,$5::float8,'2026-10-05',$6, CASE WHEN $7::date IS NULL THEN 'PENDING' ELSE 'PAID' END, $7::date, CASE WHEN $7::date IS NULL THEN NULL ELSE $5::float8 END)`,
		w.org, w.owner, unit, desc, amount, category, paid)
	require.NoError(t, err)
}

var (
	oct1 = time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
)

func TestRepository_CarneIncome_SoPessoaFisicaPorDataDePagamento(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	w := seedWorld(t, d)
	u1, l1 := w.leaseFor(t, d, "Ap 302", "Marina Souza", "PF")
	_, l2 := w.leaseFor(t, d, "Sala 3", "Empresa Ltda", "PJ")
	w.payment(t, d, l1, "RENT", "PAID", s("2026-10-05"), 1850, f(1850))
	w.payment(t, d, l1, "RENT", "PAID", s("2026-10-02"), 500, nil)         // sem líquido: bruto; mais cedo
	w.payment(t, d, l2, "RENT", "PAID", s("2026-10-05"), 3000, f(3000))    // PJ fora
	w.payment(t, d, l1, "RENT", "PAID", s("2026-09-30"), 999, f(999))      // fora do mês
	w.payment(t, d, l1, "RENT", "PAID", s("2026-11-01"), 999, f(999))      // fora do mês
	w.payment(t, d, l1, "DEPOSIT", "PAID", s("2026-10-05"), 5000, f(5000)) // não é aluguel
	w.payment(t, d, l1, "RENT", "PENDING", nil, 1000, nil)                 // não paga

	got, err := repo.CarneIncome(context.Background(), w.org, oct1, oct31)
	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "2026-10-02", got[0].PaidDate, "ordenado por data")
	assert.Equal(t, 500.0, got[0].Amount)
	assert.Equal(t, "Marina Souza", got[0].Payer)
	assert.Equal(t, u1, got[1].UnitID)
	assert.Equal(t, 1850.0, got[1].Amount)
}

func TestRepository_CarneDeductions_SoCategoriasQueEntram(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	w := seedWorld(t, d)
	unit, _ := w.leaseFor(t, d, "Ap 12", "Carla Dias", "PF")
	w.expenseIn(t, d, unit, "CONDO", "Condomínio de outubro", s("2026-10-10"), 680)
	w.expenseIn(t, d, unit, "TAX", "IPTU · parcela 10", s("2026-10-03"), 420)
	w.expenseIn(t, d, unit, "MAINTENANCE", "Reforma", s("2026-10-04"), 900)  // categoria não entra
	w.expenseIn(t, d, unit, "TAX", "IPTU pendente", nil, 100)                // não paga
	w.expenseIn(t, d, unit, "TAX", "IPTU de novembro", s("2026-11-02"), 100) // fora do mês

	got, err := repo.CarneDeductions(context.Background(), w.org, oct1, oct31, report.DeductibleCategories)
	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, "IPTU · parcela 10", got[0].Description, "ordenado por data de pagamento")
	assert.Equal(t, "TAX", got[0].Category)
	assert.Equal(t, 420.0, got[0].Amount)
	assert.Equal(t, unit, got[0].UnitID)
	assert.Equal(t, "CONDO", got[1].Category)
}

func TestRepository_Carne_IsolamentoPorOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := report.NewRepository(d)
	a := seedWorld(t, d)
	b := seedWorld(t, d)
	ua, la := a.leaseFor(t, d, "Ap A", "Pagador A", "PF")
	a.payment(t, d, la, "RENT", "PAID", s("2026-10-05"), 1000, f(1000))
	a.expenseIn(t, d, ua, "TAX", "IPTU", s("2026-10-05"), 100)

	inc, err := repo.CarneIncome(context.Background(), b.org, oct1, oct31)
	require.NoError(t, err)
	assert.Empty(t, inc)
	ded, err := repo.CarneDeductions(context.Background(), b.org, oct1, oct31, report.DeductibleCategories)
	require.NoError(t, err)
	assert.Empty(t, ded)
}

package dashboard_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/dashboard"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, payments, leases, tenants, units, properties, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

type seeded struct {
	orgID, ownerID uuid.UUID
}

func seedOrg(t *testing.T, d *db.DB) seeded {
	t.Helper()
	ctx := context.Background()
	var s seeded
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+uuid.NewString()[:8]).Scan(&s.orgID))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1,'hash',$2) RETURNING id`,
		"dash-"+uuid.NewString()[:8]+"@test.com", s.orgID).Scan(&s.ownerID))
	return s
}

func (s seeded) property(t *testing.T, d *db.DB, name string, active bool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, d.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (owner_id, organization_id, name, type, is_active) VALUES ($1,$2,$3,'RESIDENTIAL',$4) RETURNING id`,
		s.ownerID, s.orgID, name, active).Scan(&id))
	return id
}

func (s seeded) unit(t *testing.T, d *db.DB, propID uuid.UUID, label string, active bool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, d.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label, is_active) VALUES ($1,$2,$3) RETURNING id`,
		propID, label, active).Scan(&id))
	return id
}

func (s seeded) tenant(t *testing.T, d *db.DB, name string) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, d.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (owner_id, organization_id, name) VALUES ($1,$2,$3) RETURNING id`,
		s.ownerID, s.orgID, name).Scan(&id))
	return id
}

func (s seeded) lease(t *testing.T, d *db.DB, unitID, tenantID uuid.UUID, status string, end time.Time) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, d.Pool.QueryRow(context.Background(),
		`INSERT INTO leases (owner_id, organization_id, unit_id, tenant_id, start_date, end_date, status, rent_amount)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,1000) RETURNING id`,
		s.ownerID, s.orgID, unitID, tenantID, end.AddDate(-1, 0, 0), end, status).Scan(&id))
	return id
}

func (s seeded) payment(t *testing.T, d *db.DB, leaseID uuid.UUID, due time.Time, status string, amount float64) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO payments (owner_id, organization_id, lease_id, due_date, gross_amount, status, type)
		 VALUES ($1,$2,$3,$4,$5,$6,'RENT')`,
		s.ownerID, s.orgID, leaseID, due, amount, status)
	require.NoError(t, err)
}

func TestRepository_GetMetrics_Agregacao(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	now := time.Date(2026, 5, 15, 12, 0, 0, 0, time.UTC)
	day := func(n int) time.Time { return time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC).AddDate(0, 0, n) }

	p1 := s.property(t, d, "P1", true)
	s.property(t, d, "Inativa", false)
	u1 := s.unit(t, d, p1, "U1", true)
	u2 := s.unit(t, d, p1, "U2", true)
	u3 := s.unit(t, d, p1, "U3", true)
	s.unit(t, d, p1, "U4", true)
	s.unit(t, d, p1, "Inativa", false)
	tn1 := s.tenant(t, d, "João")
	tn2 := s.tenant(t, d, "Maria")
	s.tenant(t, d, "Pedro")

	l1 := s.lease(t, d, u1, tn1, "ACTIVE", day(10)) // vence em 10d
	l2 := s.lease(t, d, u2, tn2, "ACTIVE", day(90)) // fora da janela
	s.lease(t, d, u3, tn1, "ENDED", day(5))         // não conta como ocupada

	s.payment(t, d, l1, day(-1), "PAID", 1000)   // maio, pago
	s.payment(t, d, l1, day(-2), "PAID", 500)    // maio, pago
	s.payment(t, d, l2, day(5), "PENDING", 300)  // maio, a vencer
	s.payment(t, d, l2, day(-3), "PENDING", 200) // maio, vencido -> overdue
	s.payment(t, d, l2, day(-4), "LATE", 100)    // maio, LATE -> overdue
	s.payment(t, d, l2, day(-40), "PAID", 9999)  // abril, fora do mês

	got, err := repo.GetMetrics(context.Background(), s.orgID, now)

	require.NoError(t, err)
	assert.Equal(t, 1, got.TotalProperties)
	assert.Equal(t, 4, got.TotalUnits)
	assert.Equal(t, 2, got.OccupiedUnits)
	assert.Equal(t, 50.0, got.VacancyRate)
	assert.Equal(t, 3, got.TotalTenants)
	assert.InDelta(t, 1500, got.MonthlyRevenue.Paid, 0.001)
	assert.InDelta(t, 300, got.MonthlyRevenue.Pending, 0.001)
	assert.InDelta(t, 300, got.MonthlyRevenue.Overdue, 0.001)
	assert.InDelta(t, 2100, got.MonthlyRevenue.Total, 0.001)

	require.Len(t, got.RecentPayments, 6)
	assert.Equal(t, day(5).Format("2006-01-02"), got.RecentPayments[0].DueDate)
	assert.Equal(t, "João", got.RecentPayments[1].TenantName)

	require.Len(t, got.ExpiringLeases, 1)
	assert.Equal(t, l1, got.ExpiringLeases[0].ID)
	assert.Equal(t, "U1", got.ExpiringLeases[0].UnitLabel)
	assert.Equal(t, "João", got.ExpiringLeases[0].TenantName)
}

func TestRepository_GetMetrics_RecentPaymentsLimite10(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	p := s.property(t, d, "P", true)
	u := s.unit(t, d, p, "U", true)
	tn := s.tenant(t, d, "T")
	l := s.lease(t, d, u, tn, "ACTIVE", time.Now().AddDate(1, 0, 0))
	for i := 0; i < 12; i++ {
		s.payment(t, d, l, time.Now().AddDate(0, 0, -i), "PAID", 10)
	}

	got, err := repo.GetMetrics(context.Background(), s.orgID, time.Now())

	require.NoError(t, err)
	assert.Len(t, got.RecentPayments, 10)
}

func TestRepository_GetMetrics_IsolamentoPorOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	a := seedOrg(t, d)
	b := seedOrg(t, d)
	now := time.Now()

	pa := a.property(t, d, "A", true)
	ua := a.unit(t, d, pa, "UA", true)
	ta := a.tenant(t, d, "TA")
	la := a.lease(t, d, ua, ta, "ACTIVE", now.AddDate(0, 0, 5))
	a.payment(t, d, la, now, "PAID", 100)

	got, err := repo.GetMetrics(context.Background(), b.orgID, now)

	require.NoError(t, err)
	assert.Zero(t, got.TotalProperties)
	assert.Zero(t, got.TotalUnits)
	assert.Zero(t, got.OccupiedUnits)
	assert.Zero(t, got.TotalTenants)
	assert.Zero(t, got.MonthlyRevenue.Total)
	assert.Empty(t, got.RecentPayments)
	assert.Empty(t, got.ExpiringLeases)
	assert.NotNil(t, got.RecentPayments)
	assert.NotNil(t, got.ExpiringLeases)
}

// ---- helpers extras (soft-delete, end_date nulo, descrição) ----

var brt = time.FixedZone("BRT", -3*60*60)

func ymd(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }

func (s seeded) leaseFull(t *testing.T, d *db.DB, unitID, tenantID uuid.UUID, status string, end *time.Time, active bool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, d.Pool.QueryRow(context.Background(),
		`INSERT INTO leases (owner_id, organization_id, unit_id, tenant_id, start_date, end_date, status, rent_amount, is_active)
		 VALUES ($1,$2,$3,$4,'2020-01-01',$5,$6,1000,$7) RETURNING id`,
		s.ownerID, s.orgID, unitID, tenantID, end, status, active).Scan(&id))
	return id
}

func (s seeded) paymentDesc(t *testing.T, d *db.DB, leaseID uuid.UUID, due time.Time, status string, amount float64, desc *string) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(),
		`INSERT INTO payments (owner_id, organization_id, lease_id, due_date, gross_amount, status, type, description)
		 VALUES ($1,$2,$3,$4,$5,$6,'RENT',$7)`,
		s.ownerID, s.orgID, leaseID, due, amount, status, desc)
	require.NoError(t, err)
}

func (s seeded) softDelete(t *testing.T, d *db.DB, table string, id uuid.UUID) {
	t.Helper()
	_, err := d.Pool.Exec(context.Background(), "UPDATE "+table+" SET is_active=false, updated_at=NOW() WHERE id=$1", id)
	require.NoError(t, err)
}

// base: 1 property, 1 unit, 1 tenant
func (s seeded) base(t *testing.T, d *db.DB) (prop, unit, tn uuid.UUID) {
	prop = s.property(t, d, "P", true)
	unit = s.unit(t, d, prop, "U1", true)
	tn = s.tenant(t, d, "T1")
	return
}

func TestRepository_GetMetrics_FronteiraJanelaVencimento(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	today := ymd(2026, 5, 15)
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, brt)
	prop := s.property(t, d, "P", true)
	tn := s.tenant(t, d, "T")
	mk := func(label string) uuid.UUID { return s.unit(t, d, prop, label, true) }

	uToday, u30, u31, uPast, uNull, uEnded, uInactive := mk("hoje"), mk("d30"), mk("d31"), mk("ontem"), mk("null"), mk("ended"), mk("inativo")
	e := func(days int) *time.Time { v := today.AddDate(0, 0, days); return &v }
	s.leaseFull(t, d, uToday, tn, "ACTIVE", e(0), true)
	s.leaseFull(t, d, u30, tn, "ACTIVE", e(30), true)
	s.leaseFull(t, d, u31, tn, "ACTIVE", e(31), true)
	s.leaseFull(t, d, uPast, tn, "ACTIVE", e(-1), true)
	s.leaseFull(t, d, uNull, tn, "ACTIVE", nil, true)
	s.leaseFull(t, d, uEnded, tn, "ENDED", e(5), true)
	s.leaseFull(t, d, uInactive, tn, "ACTIVE", e(5), false)

	got, err := repo.GetMetrics(context.Background(), s.orgID, now)

	require.NoError(t, err)
	var labels []string
	for _, l := range got.ExpiringLeases {
		labels = append(labels, l.UnitLabel)
	}
	assert.Equal(t, []string{"hoje", "d30"}, labels)
}

func TestRepository_GetMetrics_FronteiraMes_FusoBRT(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	_, unit, tn := s.base(t, d)
	l := s.leaseFull(t, d, unit, tn, "ACTIVE", nil, true)
	// 31/05 23:30 BRT (já é 01/06 em UTC): mês corrente continua maio
	now := time.Date(2026, 5, 31, 23, 30, 0, 0, brt)

	s.payment(t, d, l, ymd(2026, 4, 30), "PAID", 1000)  // mês anterior: fora
	s.payment(t, d, l, ymd(2026, 5, 1), "PAID", 10)     // 1º dia: dentro
	s.payment(t, d, l, ymd(2026, 5, 31), "PENDING", 20) // vence hoje: pending, NÃO overdue
	s.payment(t, d, l, ymd(2026, 5, 30), "PENDING", 30) // ontem: overdue
	s.payment(t, d, l, ymd(2026, 6, 1), "PAID", 5000)   // mês seguinte: fora

	got, err := repo.GetMetrics(context.Background(), s.orgID, now)

	require.NoError(t, err)
	assert.InDelta(t, 10, got.MonthlyRevenue.Paid, 0.001)
	assert.InDelta(t, 20, got.MonthlyRevenue.Pending, 0.001)
	assert.InDelta(t, 30, got.MonthlyRevenue.Overdue, 0.001)
	assert.InDelta(t, 60, got.MonthlyRevenue.Total, 0.001)
}

func TestRepository_GetMetrics_ArredondaDinheiro(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	_, unit, tn := s.base(t, d)
	l := s.leaseFull(t, d, unit, tn, "ACTIVE", nil, true)
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, brt)
	for i := 0; i < 3; i++ {
		s.payment(t, d, l, ymd(2026, 5, 10), "PAID", 0.1)
	}

	got, err := repo.GetMetrics(context.Background(), s.orgID, now)

	require.NoError(t, err)
	assert.Equal(t, 0.3, got.MonthlyRevenue.Paid) // exato, sem 0.30000000000000004
	assert.Equal(t, 0.3, got.MonthlyRevenue.Total)
}

// Dois contratos ACTIVE na mesma unidade são impossíveis desde a migration 000039
// (constraint leases_no_overlap_per_unit); o cenário agora é um ativo mais um encerrado.
func TestRepository_GetMetrics_UnidadeComContratoAtivoEEncerrado(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	prop := s.property(t, d, "P", true)
	u1 := s.unit(t, d, prop, "U1", true)
	s.unit(t, d, prop, "U2", true)
	t1, t2 := s.tenant(t, d, "A"), s.tenant(t, d, "B")
	s.leaseFull(t, d, u1, t1, "ACTIVE", nil, true)
	s.leaseFull(t, d, u1, t2, "ENDED", nil, true)

	got, err := repo.GetMetrics(context.Background(), s.orgID, time.Now())

	require.NoError(t, err)
	assert.Equal(t, 1, got.OccupiedUnits)
	assert.Equal(t, 2, got.TotalUnits)
	assert.Equal(t, 50.0, got.VacancyRate)
}

func TestRepository_GetMetrics_SoftDeleteExcluido(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, brt)
	soon := ymd(2026, 5, 20)

	// grupo vivo
	prop, unit, tn := s.base(t, d)
	live := s.leaseFull(t, d, unit, tn, "ACTIVE", &soon, true)
	s.payment(t, d, live, ymd(2026, 5, 10), "PAID", 100)

	// lease soft-deletado: pagamento fora da receita e da lista
	uL := s.unit(t, d, prop, "UL", true)
	tL := s.tenant(t, d, "TL")
	deadLease := s.leaseFull(t, d, uL, tL, "ACTIVE", &soon, false)
	s.payment(t, d, deadLease, ymd(2026, 5, 11), "PAID", 7000)

	// tenant soft-deletado
	uT := s.unit(t, d, prop, "UT", true)
	tDead := s.tenant(t, d, "TDead")
	leaseT := s.leaseFull(t, d, uT, tDead, "ACTIVE", &soon, true)
	s.payment(t, d, leaseT, ymd(2026, 5, 12), "PAID", 8000)
	s.softDelete(t, d, "tenants", tDead)

	// unit soft-deletada
	uD := s.unit(t, d, prop, "UD", true)
	tU := s.tenant(t, d, "TU")
	leaseU := s.leaseFull(t, d, uD, tU, "ACTIVE", &soon, true)
	s.payment(t, d, leaseU, ymd(2026, 5, 13), "PAID", 9000)
	s.softDelete(t, d, "units", uD)

	// property soft-deletada (conta fora; ignora unidades dela)
	pDead := s.property(t, d, "PDead", true)
	s.unit(t, d, pDead, "UP", true)
	s.softDelete(t, d, "properties", pDead)

	got, err := repo.GetMetrics(context.Background(), s.orgID, now)

	require.NoError(t, err)
	assert.Equal(t, 1, got.TotalProperties)
	assert.Equal(t, 3, got.TotalUnits)   // U1 + UL + UT (UD e UP fora)
	assert.Equal(t, 3, got.TotalTenants) // T1, TL, TU (TDead fora)
	// receita filtra só por lease ativo: pagamentos de tenant/unit soft-deletados com lease ativo ainda contam (100+8000+9000).
	assert.InDelta(t, 17100, got.MonthlyRevenue.Paid, 0.001)
	require.Len(t, got.RecentPayments, 1)
	assert.Equal(t, "T1", got.RecentPayments[0].TenantName)
	require.Len(t, got.ExpiringLeases, 1)
	assert.Equal(t, live, got.ExpiringLeases[0].ID)
}

func TestRepository_GetMetrics_DescricaoFallbackLabelDaUnidade(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	_, unit, tn := s.base(t, d)
	l := s.leaseFull(t, d, unit, tn, "ACTIVE", nil, true)
	custom := "Aluguel maio"
	empty := ""
	s.paymentDesc(t, d, l, ymd(2026, 5, 3), "PAID", 1, &custom)
	s.paymentDesc(t, d, l, ymd(2026, 5, 2), "PAID", 1, &empty)
	s.paymentDesc(t, d, l, ymd(2026, 5, 1), "PAID", 1, nil)

	got, err := repo.GetMetrics(context.Background(), s.orgID, time.Date(2026, 5, 15, 10, 0, 0, 0, brt))

	require.NoError(t, err)
	require.Len(t, got.RecentPayments, 3)
	assert.Equal(t, "Aluguel maio", got.RecentPayments[0].Description)
	assert.Equal(t, "U1", got.RecentPayments[1].Description)
	assert.Equal(t, "U1", got.RecentPayments[2].Description)
}

func TestRepository_GetMetrics_OrgBNaoAlteraTotaisOrgA(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	a, b := seedOrg(t, d), seedOrg(t, d)
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, brt)
	soon := ymd(2026, 5, 20)

	_, uA, tA := a.base(t, d)
	lA := a.leaseFull(t, d, uA, tA, "ACTIVE", &soon, true)
	a.payment(t, d, lA, ymd(2026, 5, 10), "PAID", 100)

	before, err := repo.GetMetrics(context.Background(), a.orgID, now)
	require.NoError(t, err)

	_, uB, tB := b.base(t, d)
	lB := b.leaseFull(t, d, uB, tB, "ACTIVE", &soon, true)
	b.payment(t, d, lB, ymd(2026, 5, 10), "PAID", 999)
	b.payment(t, d, lB, ymd(2026, 5, 11), "LATE", 999)

	after, err := repo.GetMetrics(context.Background(), a.orgID, now)

	require.NoError(t, err)
	assert.Equal(t, before, after)
	assert.Equal(t, 1, after.TotalProperties)
	assert.Len(t, after.RecentPayments, 1)
	assert.Len(t, after.ExpiringLeases, 1)
}

func TestRepository_GetMetrics_TotalSemRuidoDePontoFlutuante(t *testing.T) {
	d := testDB(t)
	repo := dashboard.NewRepository(d)
	s := seedOrg(t, d)
	_, unit, tn := s.base(t, d)
	l := s.leaseFull(t, d, unit, tn, "ACTIVE", nil, true)
	now := time.Date(2026, 5, 15, 10, 0, 0, 0, brt)
	s.payment(t, d, l, ymd(2026, 5, 10), "PAID", 0.1)
	s.payment(t, d, l, ymd(2026, 5, 20), "PENDING", 0.2)

	got, err := repo.GetMetrics(context.Background(), s.orgID, now)

	require.NoError(t, err)
	assert.Equal(t, 0.3, got.MonthlyRevenue.Total) // 0.1+0.2 em float64 = 0.30000000000000004
}

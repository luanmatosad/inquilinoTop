package financial_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/financial"
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
		d.Pool.Exec(context.Background(), "TRUNCATE transfers, bank_records, organization_settings, payments, leases, tenants, units, properties, organizations, users RESTART IDENTITY CASCADE")
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
		"fin-"+uuid.NewString()[:8]+"@test.com", s.orgID).Scan(&s.ownerID))
	return s
}

// leaseFor cria imóvel, unidade, inquilino e contrato ativo; devolve o id do contrato e do imóvel.
func (s seeded) leaseFor(t *testing.T, d *db.DB) (leaseID, propertyID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO properties (owner_id, organization_id, name, type, is_active) VALUES ($1,$2,'Imóvel','RESIDENTIAL',true) RETURNING id`,
		s.ownerID, s.orgID).Scan(&propertyID))
	var unitID, tenantID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO units (property_id, label, is_active) VALUES ($1,'101',true) RETURNING id`, propertyID).Scan(&unitID))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO tenants (owner_id, organization_id, name) VALUES ($1,$2,'Inquilino') RETURNING id`,
		s.ownerID, s.orgID).Scan(&tenantID))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO leases (owner_id, organization_id, unit_id, tenant_id, start_date, end_date, status, rent_amount)
		 VALUES ($1,$2,$3,$4,'2026-01-01','2027-01-01','ACTIVE',1000) RETURNING id`,
		s.ownerID, s.orgID, unitID, tenantID).Scan(&leaseID))
	return leaseID, propertyID
}

func (s seeded) paidRent(t *testing.T, d *db.DB, leaseID uuid.UUID, due time.Time, gross float64) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	require.NoError(t, d.Pool.QueryRow(context.Background(),
		`INSERT INTO payments (owner_id, organization_id, lease_id, due_date, gross_amount, status, type)
		 VALUES ($1,$2,$3,$4,$5,'PAID','RENT') RETURNING id`,
		s.ownerID, s.orgID, leaseID, due, gross).Scan(&id))
	return id
}

func TestRepositoryAdminFee_PadraoZeroEUltimaGravacaoVence(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	pct, err := repo.AdminFeePercent(ctx, s.orgID)
	require.NoError(t, err)
	assert.Equal(t, 0.0, pct, "organização sem configuração tem taxa zero")

	require.NoError(t, repo.SetAdminFeePercent(ctx, s.orgID, 12.5))
	require.NoError(t, repo.SetAdminFeePercent(ctx, s.orgID, 7))
	pct, err = repo.AdminFeePercent(ctx, s.orgID)
	require.NoError(t, err)
	assert.Equal(t, 7.0, pct)
}

func TestRepositoryInsertTransfers_NaoDuplicaImovelNaCompetencia(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	_, propertyID := s.leaseFor(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	row := financial.Transfer{
		PropertyID: propertyID, GrossAmount: 3000, AdminFeePercent: 10,
		AdminFeeAmount: 300, NetAmount: 2700, Status: financial.StatusPending,
	}
	n, err := repo.InsertTransfers(ctx, s.orgID, "2026-05", []financial.Transfer{row})
	require.NoError(t, err)
	assert.Equal(t, 1, n)

	n, err = repo.InsertTransfers(ctx, s.orgID, "2026-05", []financial.Transfer{row})
	require.NoError(t, err)
	assert.Equal(t, 0, n, "segunda geração do mesmo mês não cria repasse")

	list, err := repo.ListTransfers(ctx, s.orgID, financial.TransferFilter{})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, 2700.0, list[0].NetAmount)
}

func TestRepositorySaveTransfer_StatusDesatualizadoRetornaConflito(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	_, propertyID := s.leaseFor(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	_, err := repo.InsertTransfers(ctx, s.orgID, "2026-05", []financial.Transfer{{
		PropertyID: propertyID, GrossAmount: 1000, AdminFeePercent: 0, NetAmount: 1000, Status: financial.StatusPending,
	}})
	require.NoError(t, err)
	list, err := repo.ListTransfers(ctx, s.orgID, financial.TransferFilter{})
	require.NoError(t, err)
	require.Len(t, list, 1)

	tr := list[0]
	tr.Status = financial.StatusProcessed
	require.NoError(t, repo.SaveTransfer(ctx, s.orgID, &tr, financial.StatusPending))

	err = repo.SaveTransfer(ctx, s.orgID, &tr, financial.StatusPending)
	assert.ErrorIs(t, err, financial.ErrConcurrentUpdate, "status já mudou: a segunda gravação não pode passar")
}

func TestRepositoryInsertBankRecord_ReimportacaoDevolveMesmoID(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	in := financial.BankRecordInput{
		Date: time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC), Description: "PIX ALUGUEL", Amount: 2500, Type: financial.TypeCredit,
	}
	id1, inserted1, err := repo.InsertBankRecord(ctx, s.orgID, in)
	require.NoError(t, err)
	assert.True(t, inserted1)

	id2, inserted2, err := repo.InsertBankRecord(ctx, s.orgID, in)
	require.NoError(t, err)
	assert.False(t, inserted2)
	assert.Equal(t, id1, id2)
}

func TestRepositoryListBankRecords_FiltraPorPeriodo(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	for _, date := range []time.Time{
		time.Date(2026, 4, 30, 0, 0, 0, 0, time.UTC), // fora do filtro
		time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC), // dentro do filtro
	} {
		_, _, err := repo.InsertBankRecord(ctx, s.orgID, financial.BankRecordInput{
			Date: date, Description: "L", Amount: 100, Type: financial.TypeCredit,
		})
		require.NoError(t, err)
	}
	from := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 31, 0, 0, 0, 0, time.UTC)
	list, err := repo.ListBankRecords(ctx, s.orgID, financial.BankRecordFilter{From: &from, To: &to})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, 2026, list[0].Date.Year())
	assert.Equal(t, time.May, list[0].Date.Month())
}

func TestRepositoryMatchBankRecord_MenorDiferencaSemReutilizarPagamento(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	leaseID, _ := s.leaseFor(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	due := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	exact := s.paidRent(t, d, leaseID, due, 2500)
	near := s.paidRent(t, d, leaseID, due, 2400)           // dentro de 5% (diferença 100 ≤ 125)
	s.paidRent(t, d, leaseID, due.AddDate(0, 0, 10), 2500) // fora da janela de ±1 dia

	record := func(amount float64, typ string) uuid.UUID {
		id, _, err := repo.InsertBankRecord(ctx, s.orgID, financial.BankRecordInput{
			Date: due, Description: "PIX " + uuid.NewString(), Amount: amount, Type: typ,
		})
		require.NoError(t, err)
		return id
	}

	first, err := repo.MatchBankRecord(ctx, s.orgID, record(2500, financial.TypeCredit))
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, exact, *first, "prefere o pagamento de menor diferença")

	second, err := repo.MatchBankRecord(ctx, s.orgID, record(2500, financial.TypeCredit))
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, near, *second, "pagamento já vinculado não pode ser reutilizado")

	none, err := repo.MatchBankRecord(ctx, s.orgID, record(2500, financial.TypeCredit))
	require.NoError(t, err)
	assert.Nil(t, none, "sem candidato livre dentro da janela, não concilia")

	debit, err := repo.MatchBankRecord(ctx, s.orgID, record(2500, financial.TypeDebit))
	require.NoError(t, err)
	assert.Nil(t, debit, "débito nunca concilia com aluguel")
}

func TestRepositoryTransfers_DesativadoSaiDaListagemENaoBloqueiaNovaGeracao(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	_, propertyID := s.leaseFor(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	row := financial.Transfer{PropertyID: propertyID, GrossAmount: 1000, NetAmount: 1000, Status: financial.StatusPending}
	_, err := repo.InsertTransfers(ctx, s.orgID, "2026-05", []financial.Transfer{row})
	require.NoError(t, err)
	_, err = d.Pool.Exec(ctx, `UPDATE transfers SET is_active = false WHERE property_id = $1`, propertyID)
	require.NoError(t, err)

	list, err := repo.ListTransfers(ctx, s.orgID, financial.TransferFilter{})
	require.NoError(t, err)
	assert.Empty(t, list, "repasse desativado não aparece na listagem")

	var ativo bool
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT is_active FROM transfers WHERE property_id = $1`, propertyID).Scan(&ativo))
	assert.False(t, ativo, "soft-delete preserva a linha com is_active=false")

	n, err := repo.InsertTransfers(ctx, s.orgID, "2026-05", []financial.Transfer{row})
	require.NoError(t, err)
	assert.Equal(t, 1, n, "repasse desativado não bloqueia nova geração do mesmo mês")

	list, err = repo.ListTransfers(ctx, s.orgID, financial.TransferFilter{})
	require.NoError(t, err)
	require.Len(t, list, 1)
}

func TestRepositoryBankRecords_DesativadoSaiDaListagemENaoBloqueiaReimportacao(t *testing.T) {
	d := testDB(t)
	s := seedOrg(t, d)
	repo := financial.NewRepository(d)
	ctx := context.Background()

	in := financial.BankRecordInput{
		Date: time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC), Description: "PIX ALUGUEL", Amount: 2500, Type: financial.TypeCredit,
	}
	id1, _, err := repo.InsertBankRecord(ctx, s.orgID, in)
	require.NoError(t, err)
	_, err = d.Pool.Exec(ctx, `UPDATE bank_records SET is_active = false WHERE id = $1`, id1)
	require.NoError(t, err)

	list, err := repo.ListBankRecords(ctx, s.orgID, financial.BankRecordFilter{})
	require.NoError(t, err)
	assert.Empty(t, list, "lançamento desativado não aparece na listagem")

	var ativo bool
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT is_active FROM bank_records WHERE id = $1`, id1).Scan(&ativo))
	assert.False(t, ativo, "soft-delete preserva a linha com is_active=false")

	id2, inserted, err := repo.InsertBankRecord(ctx, s.orgID, in)
	require.NoError(t, err)
	assert.True(t, inserted, "lançamento desativado não bloqueia reimportação")
	assert.NotEqual(t, id1, id2)
}

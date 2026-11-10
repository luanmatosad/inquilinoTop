package settings_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
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
		d.Pool.Exec(context.Background(), "TRUNCATE reminder_templates, unit_pix_accounts, organization_settings, financial_config, units, properties, organization_members, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrg(t *testing.T, d *db.DB) (orgID, userID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+uuid.NewString()[:8]).Scan(&orgID))
	require.NoError(t, d.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1,'hash',$2) RETURNING id`,
		"set-"+uuid.NewString()[:8]+"@test.com", orgID).Scan(&userID))
	return orgID, userID
}

func TestRepository_GetSemLinhaDevolveNil(t *testing.T) {
	d := testDB(t)
	orgID, _ := seedOrg(t, d)
	r, err := settings.NewRepository(d).GetFinancialRules(context.Background(), orgID)
	require.NoError(t, err)
	assert.Nil(t, r)
}

func TestRepository_SaveEAtualiza(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	ctx := context.Background()

	first := settings.FinancialRules{LateFeePercent: 2.5, MonthlyInterestPercent: 1, DefaultAdjustmentIndex: "IPCA", ReadjustNoticeDays: 45}
	saved, err := repo.SaveFinancialRules(ctx, orgID, userID, first)
	require.NoError(t, err)
	assert.Equal(t, first, *saved)

	second := settings.FinancialRules{LateFeePercent: 3, MonthlyInterestPercent: 0.5, DefaultAdjustmentIndex: "IGP-M", ReadjustNoticeDays: 90}
	_, err = repo.SaveFinancialRules(ctx, orgID, userID, second)
	require.NoError(t, err)

	got, err := repo.GetFinancialRules(ctx, orgID)
	require.NoError(t, err)
	assert.Equal(t, second, *got)

	var rows int
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM organization_settings WHERE organization_id=$1`, orgID).Scan(&rows))
	assert.Equal(t, 1, rows, "upsert, uma linha por organização")
	var by uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT updated_by FROM organization_settings WHERE organization_id=$1`, orgID).Scan(&by))
	assert.Equal(t, userID, by)
}

func TestRepository_IsolamentoPorOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	a, ua := seedOrg(t, d)
	b, _ := seedOrg(t, d)
	_, err := repo.SaveFinancialRules(context.Background(), a, ua, settings.FinancialRules{LateFeePercent: 4, MonthlyInterestPercent: 2, DefaultAdjustmentIndex: "IPCA", ReadjustNoticeDays: 30})
	require.NoError(t, err)

	got, err := repo.GetFinancialRules(context.Background(), b)
	require.NoError(t, err)
	assert.Nil(t, got, "a outra organização não vê as regras")
}

func TestRepository_BancoRecusaForaDaFaixa(t *testing.T) {
	d := testDB(t)
	orgID, _ := seedOrg(t, d)
	for _, q := range []string{
		`INSERT INTO organization_settings (organization_id, late_fee_percent) VALUES ($1, 11)`,
		`INSERT INTO organization_settings (organization_id, monthly_interest_percent) VALUES ($1, 6)`,
		`INSERT INTO organization_settings (organization_id, default_adjustment_index) VALUES ($1, 'SELIC')`,
		`INSERT INTO organization_settings (organization_id, readjust_notice_days) VALUES ($1, 0)`,
	} {
		_, err := d.Pool.Exec(context.Background(), q, orgID)
		assert.Error(t, err, q)
	}
}

// A migration copia default_late_fee/default_interest de financial_config só quando são números válidos.
func TestMigration_CopiaOsPadroesAntigosValidos(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	raw, err := os.ReadFile("../../migrations/000052_organization_settings.up.sql")
	require.NoError(t, err)
	sql := string(raw)
	copyStmt := sql[strings.Index(sql, "INSERT INTO organization_settings"):]

	type seed struct {
		config       string
		active       bool
		wantFee      float64
		wantInterest float64
	}
	seeds := map[string]seed{
		"valido":     {`{"default_late_fee": 3, "default_interest": 0.5}`, true, 3, 0.5},
		"texto":      {`{"default_late_fee": "abc", "default_interest": "1.5"}`, true, 2, 1.5},
		"fora":       {`{"default_late_fee": 15, "default_interest": 7}`, true, 2, 1},
		"sem chaves": {`{"api_key": "x"}`, true, 2, 1},
		"inativo":    {`{"default_late_fee": 4}`, false, -1, -1}, // não copia
	}
	orgs := map[string]uuid.UUID{}
	for name, s := range seeds {
		orgID, userID := seedOrg(t, d)
		orgs[name] = orgID
		_, err := d.Pool.Exec(ctx,
			`INSERT INTO financial_config (owner_id, organization_id, provider, config, is_active) VALUES ($1,$2,'MOCK',$3::jsonb,$4)`,
			userID, orgID, s.config, s.active)
		require.NoError(t, err, name)
	}
	_, err = d.Pool.Exec(ctx, `TRUNCATE organization_settings`)
	require.NoError(t, err)
	_, err = d.Pool.Exec(ctx, copyStmt)
	require.NoError(t, err, "a cópia não pode falhar com valor inválido")

	for name, s := range seeds {
		var fee, interest float64
		err := d.Pool.QueryRow(ctx, `SELECT late_fee_percent::float8, monthly_interest_percent::float8 FROM organization_settings WHERE organization_id=$1`, orgs[name]).Scan(&fee, &interest)
		if s.wantFee < 0 {
			assert.Error(t, err, name+": configuração inativa não é copiada")
			continue
		}
		require.NoError(t, err, name)
		assert.Equal(t, s.wantFee, fee, name+" multa")
		assert.Equal(t, s.wantInterest, interest, name+" juros")
	}
}

func seedUnit(t *testing.T, d *db.DB, orgID, ownerID uuid.UUID, label string) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var propertyID, unitID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1,$2,'RESIDENTIAL','Prédio') RETURNING id`, orgID, ownerID).Scan(&propertyID))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO units (property_id, label) VALUES ($1,$2) RETURNING id`, propertyID, label).Scan(&unitID))
	return unitID
}

var cpfAccount = settings.PixAccount{KeyType: "CPF", Key: "52998224725", ReceiverName: "Luan Matos", City: "Manaus"}

func TestRepository_PixDefault_SalvaELe(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	ctx := context.Background()

	none, err := repo.GetPixDefault(ctx, orgID)
	require.NoError(t, err)
	assert.Nil(t, none)

	saved, err := repo.SavePixDefault(ctx, orgID, userID, cpfAccount)
	require.NoError(t, err)
	assert.Equal(t, settings.PixDefault{Configured: true, KeyType: "CPF", Key: "52998224725", ReceiverName: "Luan Matos", City: "Manaus"}, *saved)
	got, err := repo.GetPixDefault(ctx, orgID)
	require.NoError(t, err)
	assert.Equal(t, *saved, *got)

	var by uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT pix_updated_by FROM organization_settings WHERE organization_id=$1`, orgID).Scan(&by))
	assert.Equal(t, userID, by)

	// nome e cidade vazios viram NULL e voltam vazios
	_, err = repo.SavePixDefault(ctx, orgID, userID, settings.PixAccount{KeyType: "EMAIL", Key: "a@b.com"})
	require.NoError(t, err)
	got, _ = repo.GetPixDefault(ctx, orgID)
	assert.Equal(t, settings.PixDefault{Configured: true, KeyType: "EMAIL", Key: "a@b.com"}, *got)
}

func TestRepository_PixEsRegrasNaoSeApagam(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	ctx := context.Background()
	rules := settings.FinancialRules{LateFeePercent: 3, MonthlyInterestPercent: 2, DefaultAdjustmentIndex: "IPCA", ReadjustNoticeDays: 45}

	_, err := repo.SaveFinancialRules(ctx, orgID, userID, rules)
	require.NoError(t, err)
	_, err = repo.SavePixDefault(ctx, orgID, userID, cpfAccount)
	require.NoError(t, err)
	got, _ := repo.GetFinancialRules(ctx, orgID)
	assert.Equal(t, rules, *got, "salvar o Pix não mexe nas regras")

	rules.LateFeePercent = 4
	_, err = repo.SaveFinancialRules(ctx, orgID, userID, rules)
	require.NoError(t, err)
	pix, _ := repo.GetPixDefault(ctx, orgID)
	assert.Equal(t, "52998224725", pix.Key, "salvar as regras não apaga o Pix")
}

func TestRepository_PixOrgSemLinhaDeRegrasCriaComPadroes(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	_, err := repo.SavePixDefault(context.Background(), orgID, userID, cpfAccount)
	require.NoError(t, err)
	r, err := repo.GetFinancialRules(context.Background(), orgID)
	require.NoError(t, err)
	assert.Equal(t, settings.DefaultFinancialRules(), *r)
}

func TestRepository_BancoExigeChaveETipoJuntos(t *testing.T) {
	d := testDB(t)
	orgID, _ := seedOrg(t, d)
	_, err := d.Pool.Exec(context.Background(), `INSERT INTO organization_settings (organization_id, pix_key) VALUES ($1, 'x')`, orgID)
	assert.Error(t, err)
	_, err = d.Pool.Exec(context.Background(), `INSERT INTO organization_settings (organization_id, pix_key, pix_key_type) VALUES ($1, 'x', 'OUTRO')`, orgID)
	assert.Error(t, err)
}

func TestRepository_UnitPix_TrocaDesativaERemoveMantemHistorico(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	unit := seedUnit(t, d, orgID, userID, "Sala 3")
	ctx := context.Background()

	none, err := repo.GetUnitPix(ctx, orgID, unit)
	require.NoError(t, err)
	assert.Nil(t, none)

	first, err := repo.SaveUnitPix(ctx, orgID, unit, userID, settings.PixAccount{KeyType: "CNPJ", Key: "11222333000181", ReceiverName: "Centro Ltda"})
	require.NoError(t, err)
	assert.Equal(t, unit, first.UnitID)
	assert.False(t, first.ConfirmedAt.IsZero())

	_, err = repo.SaveUnitPix(ctx, orgID, unit, userID, settings.PixAccount{KeyType: "EMAIL", Key: "socio@email.com"})
	require.NoError(t, err)
	got, _ := repo.GetUnitPix(ctx, orgID, unit)
	assert.Equal(t, "socio@email.com", got.Key)

	var total, active int
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM unit_pix_accounts WHERE unit_id=$1`, unit).Scan(&total, &active))
	assert.Equal(t, 2, total, "a anterior fica no histórico")
	assert.Equal(t, 1, active)
	var by uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT confirmed_by FROM unit_pix_accounts WHERE unit_id=$1 AND is_active`, unit).Scan(&by))
	assert.Equal(t, userID, by)

	require.NoError(t, repo.RemoveUnitPix(ctx, orgID, unit))
	gone, _ := repo.GetUnitPix(ctx, orgID, unit)
	assert.Nil(t, gone)
	assert.ErrorIs(t, repo.RemoveUnitPix(ctx, orgID, unit), apierr.ErrNotFound, "já está na chave padrão")
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM unit_pix_accounts WHERE unit_id=$1`, unit).Scan(&total))
	assert.Equal(t, 2, total, "remover só desativa")

	_, err = repo.SaveUnitPix(ctx, orgID, unit, userID, settings.PixAccount{KeyType: "PHONE", Key: "+5592999990000"})
	require.NoError(t, err)
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM unit_pix_accounts WHERE unit_id=$1`, unit).Scan(&total))
	assert.Equal(t, 3, total)
}

func TestRepository_UnitPix_ListaSoAsAtivasDaOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgA, userA := seedOrg(t, d)
	orgB, userB := seedOrg(t, d)
	a1 := seedUnit(t, d, orgA, userA, "Ap 1")
	a2 := seedUnit(t, d, orgA, userA, "Ap 2")
	b1 := seedUnit(t, d, orgB, userB, "Ap B")
	ctx := context.Background()
	for _, u := range []struct {
		org, unit, user uuid.UUID
	}{{orgA, a1, userA}, {orgA, a2, userA}, {orgB, b1, userB}} {
		_, err := repo.SaveUnitPix(ctx, u.org, u.unit, u.user, settings.PixAccount{KeyType: "EMAIL", Key: "x@y.com"})
		require.NoError(t, err)
	}
	require.NoError(t, repo.RemoveUnitPix(ctx, orgA, a2))

	list, err := repo.ListUnitPix(ctx, orgA)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, a1, list[0].UnitID)
}

func TestRepository_UnitPix_UnidadeDeOutraOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgA, userA := seedOrg(t, d)
	orgB, _ := seedOrg(t, d)
	unitA := seedUnit(t, d, orgA, userA, "Ap A")
	ctx := context.Background()

	_, err := repo.SaveUnitPix(ctx, orgB, unitA, userA, settings.PixAccount{KeyType: "EMAIL", Key: "x@y.com"})
	assert.ErrorIs(t, err, apierr.ErrNotFound, "a organização B não grava na unidade da A")
	_, err = repo.SaveUnitPix(ctx, orgA, uuid.New(), userA, settings.PixAccount{KeyType: "EMAIL", Key: "x@y.com"})
	assert.ErrorIs(t, err, apierr.ErrNotFound, "unidade inexistente")

	_, err = repo.SaveUnitPix(ctx, orgA, unitA, userA, settings.PixAccount{KeyType: "EMAIL", Key: "x@y.com"})
	require.NoError(t, err)
	got, err := repo.GetUnitPix(ctx, orgB, unitA)
	require.NoError(t, err)
	assert.Nil(t, got, "a B não enxerga a conta da A")
	assert.ErrorIs(t, repo.RemoveUnitPix(ctx, orgB, unitA), apierr.ErrNotFound)
}

func TestRepository_Reminders_SemLinhasDevolveVazio(t *testing.T) {
	d := testDB(t)
	orgID, _ := seedOrg(t, d)
	got, err := settings.NewRepository(d).ListReminders(context.Background(), orgID)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestRepository_Reminders_SubstituiDesativandoOsAntigos(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	ctx := context.Background()

	first := []settings.Reminder{{Name: "Antes", OffsetDays: -3, Body: "Oi {nome}"}, {Name: "No dia", OffsetDays: 0, Body: "Hoje {valor}"}}
	require.NoError(t, repo.ReplaceReminders(ctx, orgID, userID, first))
	got, err := repo.ListReminders(ctx, orgID)
	require.NoError(t, err)
	assert.Equal(t, first, got, "ordenado por dias")

	second := []settings.Reminder{{Name: "Atraso", OffsetDays: 5, Body: "Atrasou {valor}"}, {Name: "No dia", OffsetDays: 0, Body: "Hoje {valor} no {pix}"}}
	require.NoError(t, repo.ReplaceReminders(ctx, orgID, userID, second))
	got, _ = repo.ListReminders(ctx, orgID)
	assert.Equal(t, []settings.Reminder{second[1], second[0]}, got)

	var total, active int
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) FROM reminder_templates WHERE organization_id=$1`, orgID).Scan(&total, &active))
	assert.Equal(t, 4, total, "os dois primeiros ficam no histórico")
	assert.Equal(t, 2, active)
	var by uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT created_by FROM reminder_templates WHERE organization_id=$1 AND is_active LIMIT 1`, orgID).Scan(&by))
	assert.Equal(t, userID, by)
}

func TestRepository_Reminders_IsolamentoPorOrganizacao(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	a, ua := seedOrg(t, d)
	b, _ := seedOrg(t, d)
	require.NoError(t, repo.ReplaceReminders(context.Background(), a, ua, []settings.Reminder{{Name: "A", OffsetDays: 0, Body: "x"}}))
	got, err := repo.ListReminders(context.Background(), b)
	require.NoError(t, err)
	assert.Empty(t, got)
}

func TestRepository_Reminders_BancoRecusaDiasRepetidosEForaDaFaixa(t *testing.T) {
	d := testDB(t)
	orgID, userID := seedOrg(t, d)
	ctx := context.Background()
	ins := `INSERT INTO reminder_templates (organization_id, name, offset_days, body, created_by) VALUES ($1,'x',$2,'y',$3)`
	_, err := d.Pool.Exec(ctx, ins, orgID, 0, userID)
	require.NoError(t, err)
	_, err = d.Pool.Exec(ctx, ins, orgID, 0, userID)
	assert.Error(t, err, "dias repetidos entre ativos")
	_, err = d.Pool.Exec(ctx, ins, orgID, 99, userID)
	assert.Error(t, err, "fora da faixa")
}

func TestRepository_Reminders_FalhaNaSubstituicaoNaoPerdeOsAtuais(t *testing.T) {
	d := testDB(t)
	repo := settings.NewRepository(d)
	orgID, userID := seedOrg(t, d)
	ctx := context.Background()
	good := []settings.Reminder{{Name: "Atual", OffsetDays: 0, Body: "ok"}}
	require.NoError(t, repo.ReplaceReminders(ctx, orgID, userID, good))

	// dias fora da faixa quebram o INSERT no meio: a transação volta e os atuais continuam ativos
	err := repo.ReplaceReminders(ctx, orgID, userID, []settings.Reminder{{Name: "Novo", OffsetDays: 0, Body: "ok"}, {Name: "Quebra", OffsetDays: 99, Body: "x"}})
	require.Error(t, err)
	got, _ := repo.ListReminders(ctx, orgID)
	assert.Equal(t, good, got)
}

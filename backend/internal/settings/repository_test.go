package settings_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_settings, financial_config, organization_members, organizations, users RESTART IDENTITY CASCADE")
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
		"valido":      {`{"default_late_fee": 3, "default_interest": 0.5}`, true, 3, 0.5},
		"texto":       {`{"default_late_fee": "abc", "default_interest": "1.5"}`, true, 2, 1.5},
		"fora":        {`{"default_late_fee": 15, "default_interest": 7}`, true, 2, 1},
		"sem chaves":  {`{"api_key": "x"}`, true, 2, 1},
		"inativo":     {`{"default_late_fee": 4}`, false, -1, -1}, // não copia
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

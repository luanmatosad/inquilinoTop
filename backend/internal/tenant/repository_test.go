package tenant_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, leases, units, properties, tenants, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrgAndUser(t *testing.T, database *db.DB) (orgID, userID uuid.UUID) {
	t.Helper()

	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (id, name) VALUES (gen_random_uuid(), $1) RETURNING id`,
		"Test Org "+uuid.New().String()[:8],
	).Scan(&newOrgID)
	require.NoError(t, err)

	var newUserID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (id, email, password_hash, organization_id) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
		"tenant-"+uuid.New().String()[:8]+"@test.com", "hash", newOrgID,
	).Scan(&newUserID)
	require.NoError(t, err)

	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (gen_random_uuid(), $1, $2, 'owner')`,
		newOrgID, newUserID,
	)
	require.NoError(t, err)

	return newOrgID, newUserID
}

func TestTenantRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)

	email := "joao@example.com"
	ten, err := repo.Create(context.Background(), userID, orgID, tenant.CreateTenantInput{Name: "João Silva", Email: &email})
	require.NoError(t, err)
	assert.Equal(t, "João Silva", ten.Name)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestTenantRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)

	ten, err := repo.Create(context.Background(), userID, orgID, tenant.CreateTenantInput{Name: "Maria"})
	require.NoError(t, err)
	require.NotNil(t, ten)
	err = repo.Delete(context.Background(), ten.ID, orgID)
	require.NoError(t, err)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 0)
}

func TestRepository_Create_PersonTypePJ(t *testing.T) {
	d := testDB(t)
	orgID, userID := seedOrgAndUser(t, d)
	repo := tenant.NewRepository(d)

	pt := "PJ"
	tn, err := repo.Create(context.Background(), userID, orgID, tenant.CreateTenantInput{
		Name:       "Empresa X",
		PersonType: &pt,
	})
	require.NoError(t, err)
	assert.Equal(t, "PJ", tn.PersonType)

	_ = userID // suppress unused warning
	got, err := repo.GetByID(context.Background(), tn.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, "PJ", got.PersonType)
}

func strPtr(s string) *string { return &s }

func TestTenantRepository_CamposDeEndereço(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)

	pt := "PF"
	created, err := repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{
		Name: "Ana", PersonType: &pt, PostalCode: strPtr("01310100"), AddressLine: strPtr("Av. Paulista, 1000"),
		City: strPtr("São Paulo"), State: strPtr("SP"), Notes: strPtr("prefere contato por e-mail"),
	})
	require.NoError(t, err)

	got, err := repo.GetByID(ctx, created.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, "01310100", *got.PostalCode)
	assert.Equal(t, "SP", *got.State)
	assert.Equal(t, "prefere contato por e-mail", *got.Notes)

	up, err := repo.Update(ctx, created.ID, orgID, tenant.CreateTenantInput{Name: "Ana", PersonType: &pt, City: strPtr("Campinas")})
	require.NoError(t, err)
	assert.Equal(t, "Campinas", *up.City)
	assert.Nil(t, up.PostalCode, "campos não enviados no PUT são limpos")
}

func TestTenantRepository_DocumentoÚnicoPorOrganização(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)
	pt, doc := "PF", "52998224725"

	first, err := repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "Ana", PersonType: &pt, Document: &doc})
	require.NoError(t, err)

	_, err = repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "Outra", PersonType: &pt, Document: &doc})
	assert.ErrorIs(t, err, tenant.ErrDuplicateDocument)

	// outro documento, depois tenta atualizar para o duplicado
	doc2 := "11144477735"
	second, err := repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "Bia", PersonType: &pt, Document: &doc2})
	require.NoError(t, err)
	_, err = repo.Update(ctx, second.ID, orgID, tenant.CreateTenantInput{Name: "Bia", PersonType: &pt, Document: &doc})
	assert.ErrorIs(t, err, tenant.ErrDuplicateDocument)

	// sem documento pode repetir
	_, err = repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "S1", PersonType: &pt})
	require.NoError(t, err)
	_, err = repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "S2", PersonType: &pt})
	require.NoError(t, err)

	// reuso após soft-delete
	require.NoError(t, repo.Delete(ctx, first.ID, orgID))
	_, err = repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "Ana de novo", PersonType: &pt, Document: &doc})
	assert.NoError(t, err)
}

func TestTenantRepository_MesmoDocumentoEmOutraOrganização(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgA, userA := seedOrgAndUser(t, database)
	orgB, userB := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)
	pt, doc := "PF", "52998224725"

	_, err := repo.Create(ctx, userA, orgA, tenant.CreateTenantInput{Name: "Ana", PersonType: &pt, Document: &doc})
	require.NoError(t, err)
	_, err = repo.Create(ctx, userB, orgB, tenant.CreateTenantInput{Name: "Ana", PersonType: &pt, Document: &doc})
	assert.NoError(t, err)

	list, err := repo.List(ctx, orgA)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestTenantRepository_HasActiveLease(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := tenant.NewRepository(database)
	checker := tenant.NewLeaseChecker(database)
	pt := "PF"
	tn, err := repo.Create(ctx, userID, orgID, tenant.CreateTenantInput{Name: "Ana", PersonType: &pt})
	require.NoError(t, err)

	has, err := checker.HasActiveLease(ctx, tn.ID, orgID)
	require.NoError(t, err)
	assert.False(t, has)

	var propID, unitID uuid.UUID
	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1,$2,'SINGLE','Casa') RETURNING id`, orgID, userID).Scan(&propID))
	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO units (property_id, label) VALUES ($1,'Unidade 01') RETURNING id`, propID).Scan(&unitID))
	var leaseID uuid.UUID
	require.NoError(t, database.Pool.QueryRow(ctx,
		`INSERT INTO leases (organization_id, owner_id, unit_id, tenant_id, start_date, rent_amount, status)
		 VALUES ($1,$2,$3,$4,CURRENT_DATE,1000,'ACTIVE') RETURNING id`, orgID, userID, unitID, tn.ID).Scan(&leaseID))

	has, err = checker.HasActiveLease(ctx, tn.ID, orgID)
	require.NoError(t, err)
	assert.True(t, has)

	has, err = checker.HasActiveLease(ctx, tn.ID, uuid.New())
	require.NoError(t, err)
	assert.False(t, has, "outra organização não enxerga o contrato")

	_, err = database.Pool.Exec(ctx, `UPDATE leases SET status='ENDED' WHERE id=$1`, leaseID)
	require.NoError(t, err)
	has, err = checker.HasActiveLease(ctx, tn.ID, orgID)
	require.NoError(t, err)
	assert.False(t, has)
}

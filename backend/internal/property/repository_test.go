package property_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, properties, units, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrgAndUser(t *testing.T, database *db.DB) (orgID, userID uuid.UUID) {
	t.Helper()

	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
		"Test Org",
	).Scan(&newOrgID)
	require.NoError(t, err)

	var newUserID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, $2, $3) RETURNING id`,
		"owner@test.com", "hash", newOrgID,
	).Scan(&newUserID)
	require.NoError(t, err)

	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
		newOrgID, newUserID,
	)
	require.NoError(t, err)

	return newOrgID, newUserID
}

func TestRepository_CreateAndListProperties(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	name := "Edificio Central"
	p, err := repo.Create(context.Background(), userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: name})
	require.NoError(t, err)
	assert.Equal(t, name, p.Name)
	assert.Equal(t, orgID, p.OrganizationID)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestRepository_DeleteProperty_SoftDelete(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(context.Background(), userID, orgID, property.CreatePropertyInput{Type: "SINGLE", Name: "Casa"})
	err := repo.Delete(context.Background(), p.ID, orgID)
	require.NoError(t, err)

	list, _ := repo.List(context.Background(), orgID)
	assert.Len(t, list, 0)
}

func TestRepository_CreateUnit(t *testing.T) {
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	p, _ := repo.Create(context.Background(), userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	unit, err := repo.CreateUnit(context.Background(), p.ID, property.CreateUnitInput{Label: "Apt 101"})
	require.NoError(t, err)
	assert.Equal(t, "Apt 101", unit.Label)
}

func TestRepository_Property_CamposDeEndereço(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	cep, bairro := "01310100", "Bela Vista"
	p, err := repo.Create(ctx, userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio", PostalCode: &cep, Neighborhood: &bairro})
	require.NoError(t, err)
	require.NotNil(t, p.PostalCode)
	assert.Equal(t, cep, *p.PostalCode)

	novo := "04538133"
	up, err := repo.Update(ctx, p.ID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio", PostalCode: &novo, Neighborhood: &bairro})
	require.NoError(t, err)
	assert.Equal(t, novo, *up.PostalCode)

	got, err := repo.GetByID(ctx, p.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, bairro, *got.Neighborhood)
}

func TestRepository_Unit_MedidasEÍndiceÚnico(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)
	p, _ := repo.Create(ctx, userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})

	area, quartos, banheiros := 54.5, 2, 1
	u, err := repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "Apto 101", AreaM2: &area, Bedrooms: &quartos, Bathrooms: &banheiros})
	require.NoError(t, err)
	require.NotNil(t, u.AreaM2)
	assert.InDelta(t, 54.5, *u.AreaM2, 0.001)
	assert.Equal(t, 2, *u.Bedrooms)

	_, err = repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "APTO 101"})
	assert.ErrorIs(t, err, property.ErrDuplicateUnitLabel)

	u2, err := repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "Apto 102"})
	require.NoError(t, err)
	_, err = repo.UpdateUnit(ctx, u2.ID, orgID, property.CreateUnitInput{Label: "apto 101"})
	assert.ErrorIs(t, err, property.ErrDuplicateUnitLabel)
}

func TestRepository_Unit_RótuloLiberadoAposSoftDelete(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)
	p, _ := repo.Create(ctx, userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})

	u, err := repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "101"})
	require.NoError(t, err)
	require.NoError(t, repo.DeleteUnit(ctx, u.ID, orgID))

	_, err = repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "101"})
	assert.NoError(t, err)
}

func TestRepository_Property_ComercialComNumeroEComplemento(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)

	num, comp := "300", "Sala 2"
	p, err := repo.Create(ctx, userID, orgID, property.CreatePropertyInput{Type: "COMMERCIAL", Name: "Centro Empresarial", Number: &num, Complement: &comp})
	require.NoError(t, err)
	assert.Equal(t, "COMMERCIAL", p.Type)
	require.NotNil(t, p.Number)
	assert.Equal(t, num, *p.Number)

	novo := "310"
	up, err := repo.Update(ctx, p.ID, orgID, property.CreatePropertyInput{Type: "COMMERCIAL", Name: "Centro Empresarial", Number: &novo, Complement: &comp})
	require.NoError(t, err)
	assert.Equal(t, novo, *up.Number)

	got, err := repo.GetByID(ctx, p.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, comp, *got.Complement)

	list, err := repo.List(ctx, orgID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, "COMMERCIAL", list[0].Type)
	assert.Equal(t, novo, *list[0].Number)
}

func TestRepository_Unit_AluguelDeReferencia(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, userID := seedOrgAndUser(t, database)
	repo := property.NewRepository(database)
	p, err := repo.Create(ctx, userID, orgID, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Predio"})
	require.NoError(t, err)

	rent := 1850.5
	u, err := repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "Apto 101", ReferenceRent: &rent})
	require.NoError(t, err)
	require.NotNil(t, u.ReferenceRent)
	assert.InDelta(t, 1850.5, *u.ReferenceRent, 0.001)

	semValor, err := repo.CreateUnit(ctx, p.ID, property.CreateUnitInput{Label: "Apto 102"})
	require.NoError(t, err)
	assert.Nil(t, semValor.ReferenceRent)

	novo := 2000.0
	up, err := repo.UpdateUnit(ctx, u.ID, orgID, property.CreateUnitInput{Label: "Apto 101", ReferenceRent: &novo})
	require.NoError(t, err)
	assert.InDelta(t, 2000.0, *up.ReferenceRent, 0.001)

	got, err := repo.GetUnit(ctx, u.ID, orgID)
	require.NoError(t, err)
	assert.InDelta(t, 2000.0, *got.ReferenceRent, 0.001)

	list, err := repo.ListUnits(ctx, p.ID)
	require.NoError(t, err)
	require.Len(t, list, 2)
	byLabel := map[string]*float64{}
	for _, x := range list {
		byLabel[x.Label] = x.ReferenceRent
	}
	assert.InDelta(t, 2000.0, *byLabel["Apto 101"], 0.001)
	assert.Nil(t, byLabel["Apto 102"])

	byProps, err := repo.ListUnitsByPropertyIDs(ctx, []uuid.UUID{p.ID})
	require.NoError(t, err)
	require.Len(t, byProps, 2)

	// Limpar o valor: enviar sem reference_rent zera o campo (PUT é substituição total).
	cleared, err := repo.UpdateUnit(ctx, u.ID, orgID, property.CreateUnitInput{Label: "Apto 101"})
	require.NoError(t, err)
	assert.Nil(t, cleared.ReferenceRent)
}

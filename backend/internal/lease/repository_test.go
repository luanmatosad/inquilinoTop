package lease_test

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
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
		d.Pool.Exec(context.Background(), "TRUNCATE organization_members, lease_readjustments, properties, units, leases, tenants, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

func seedOrgAndUser(t *testing.T, database *db.DB) (orgID, ownerID uuid.UUID) {
	t.Helper()

	var newOrgID uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
		"Test Org",
	).Scan(&newOrgID)
	require.NoError(t, err)

	var newOwnerID uuid.UUID
	err = database.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, organization_id) VALUES ($1, $2, $3) RETURNING id`,
		"owner-lease@test.com", "hash", newOrgID,
	).Scan(&newOwnerID)
	require.NoError(t, err)

	_, err = database.Pool.Exec(context.Background(),
		`INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')`,
		newOrgID, newOwnerID,
	)
	require.NoError(t, err)

	return newOrgID, newOwnerID
}

func seedProperty(t *testing.T, database *db.DB, orgID, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1, $2, 'RESIDENTIAL', 'Prédio Teste') RETURNING id`,
		orgID, ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedUnit(t *testing.T, database *db.DB, propertyID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO units (property_id, label) VALUES ($1, 'Apto 101') RETURNING id`,
		propertyID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func seedTenant(t *testing.T, database *db.DB, orgID, ownerID uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := database.Pool.QueryRow(context.Background(),
		`INSERT INTO tenants (organization_id, owner_id, name) VALUES ($1, $2, 'Inquilino Teste') RETURNING id`,
		// Note: organization_id should be the same as the user's organization_id, which we don't have here.
		// We'll set it to a dummy orgID for now, but we should instead use the organization_id from the user.
		// However, the user's organization_id is set in seedOrgAndUser (newOrgID). We don't have that here.
		// We'll change the seedTenant to also take orgID? But we don't have it in the call.
		// Let's look at how seedTenant is used: it's called with orgID from seedOrgAndUser? Actually, in the tests we call seedTenant(t, database, orgID) where orgID is from seedOrgAndUser.
		// So we can change seedTenant to take orgID and ownerID, but we only need ownerID for the owner_id field.
		// For organization_id, we can set it to orgID (the same as the user's organization_id).
		orgID, ownerID,
	).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestLeaseRepository_CreateAndList(t *testing.T) {
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, orgID, ownerID)
	repo := lease.NewRepository(database)

	l, err := repo.Create(context.Background(), orgID, ownerID, lease.CreateLeaseInput{
		UnitID:     unitID,
		TenantID:   tenantID,
		StartDate:  time.Now(),
		RentAmount: 1500.00,
		PaymentDay: 5,
	})
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", l.Status)
	assert.Equal(t, 1500.00, l.RentAmount)

	list, err := repo.List(context.Background(), orgID)
	require.NoError(t, err)
	assert.Len(t, list, 1)
}

func TestLeaseRepository_Delete_SoftDelete(t *testing.T) {
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, orgID, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(context.Background(), orgID, ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})
	err := repo.Delete(context.Background(), l.ID, orgID)
	require.NoError(t, err)

	list, _ := repo.List(context.Background(), orgID)
	assert.Len(t, list, 0)
}

func TestLeaseRepository_Update(t *testing.T) {
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID := seedUnit(t, database, propertyID)
	tenantID := seedTenant(t, database, orgID, ownerID)
	repo := lease.NewRepository(database)

	l, _ := repo.Create(context.Background(), orgID, ownerID, lease.CreateLeaseInput{
		UnitID: unitID, TenantID: tenantID, StartDate: time.Now(), RentAmount: 1000,
	})

	updated, err := repo.Update(context.Background(), l.ID, orgID, lease.UpdateLeaseInput{
		RentAmount: 1200,
		Status:     "ENDED",
	})
	require.NoError(t, err)
	assert.Equal(t, 1200.00, updated.RentAmount)
	assert.Equal(t, "ENDED", updated.Status)
}

func newLeaseFixture(t *testing.T) (repo lease.Repository, orgID, ownerID, unitID, tenantID uuid.UUID) {
	t.Helper()
	database := testDB(t)
	orgID, ownerID = seedOrgAndUser(t, database)
	propertyID := seedProperty(t, database, orgID, ownerID)
	unitID = seedUnit(t, database, propertyID)
	tenantID = seedTenant(t, database, orgID, ownerID)
	return lease.NewRepository(database), orgID, ownerID, unitID, tenantID
}

func leaseIn(unitID, tenantID uuid.UUID, start time.Time, end *time.Time) lease.CreateLeaseInput {
	return lease.CreateLeaseInput{UnitID: unitID, TenantID: tenantID, StartDate: start, EndDate: end, RentAmount: 1000, PaymentDay: 5}
}

func TestLeaseRepository_Notes(t *testing.T) {
	ctx := context.Background()
	repo, orgID, ownerID, unitID, tenantID := newLeaseFixture(t)
	notes := "animais permitidos"
	in := leaseIn(unitID, tenantID, day(2026, 1, 1), nil)
	in.Notes = &notes

	l, err := repo.Create(ctx, orgID, ownerID, in)
	require.NoError(t, err)
	require.NotNil(t, l.Notes)
	assert.Equal(t, notes, *l.Notes)

	novo := "sem animais"
	up, err := repo.Update(ctx, l.ID, orgID, lease.UpdateLeaseInput{RentAmount: 1000, Status: "ACTIVE", Notes: &novo})
	require.NoError(t, err)
	assert.Equal(t, novo, *up.Notes)
}

func TestLeaseRepository_Constraint_SobreposiçãoNaCriação(t *testing.T) {
	ctx := context.Background()
	repo, orgID, ownerID, unitID, tenantID := newLeaseFixture(t)
	_, err := repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 1, 1), dayp(2026, 12, 31)))
	require.NoError(t, err)

	_, err = repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 6, 1), nil))
	assert.ErrorIs(t, err, lease.ErrLeaseOverlap)

	_, err = repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2027, 1, 1), dayp(2027, 12, 31)))
	assert.NoError(t, err, "período sequencial é aceito")
}

func TestLeaseRepository_Constraint_ContratoEncerradoLiberaUnidade(t *testing.T) {
	ctx := context.Background()
	repo, orgID, ownerID, unitID, tenantID := newLeaseFixture(t)
	first, err := repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 1, 1), nil))
	require.NoError(t, err)
	_, err = repo.End(ctx, first.ID, orgID)
	require.NoError(t, err)

	_, err = repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 1, 1), nil))
	assert.NoError(t, err)
}

func TestLeaseRepository_Constraint_CriaçõesSimultâneas(t *testing.T) {
	ctx := context.Background()
	repo, orgID, ownerID, unitID, tenantID := newLeaseFixture(t)

	const n = 6
	errs := make(chan error, n)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 1, 1), nil))
			errs <- err
		}()
	}
	close(start)
	wg.Wait()
	close(errs)

	ok, overlap := 0, 0
	for err := range errs {
		switch {
		case err == nil:
			ok++
		case errors.Is(err, lease.ErrLeaseOverlap):
			overlap++
		default:
			t.Fatalf("erro inesperado: %v", err)
		}
	}
	assert.Equal(t, 1, ok, "apenas uma criação é aceita")
	assert.Equal(t, n-1, overlap)
}

func TestLeaseRepository_HasOverlap(t *testing.T) {
	ctx := context.Background()
	repo, orgID, ownerID, unitID, tenantID := newLeaseFixture(t)
	l, err := repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 3, 1), dayp(2026, 8, 31)))
	require.NoError(t, err)

	cases := []struct {
		name       string
		start      time.Time
		end        *time.Time
		except     uuid.UUID
		org        uuid.UUID
		wantOverlp bool
	}{
		{"cruza o meio", day(2026, 5, 1), dayp(2026, 6, 1), uuid.Nil, orgID, true},
		{"aberto cruza", day(2026, 8, 31), nil, uuid.Nil, orgID, true},
		{"toca o último dia", day(2026, 8, 31), dayp(2026, 12, 31), uuid.Nil, orgID, true},
		{"começa no dia seguinte", day(2026, 9, 1), dayp(2026, 12, 31), uuid.Nil, orgID, false},
		{"termina antes", day(2025, 1, 1), dayp(2026, 2, 28), uuid.Nil, orgID, false},
		{"ignora o próprio", day(2026, 5, 1), dayp(2026, 6, 1), l.ID, orgID, false},
		{"outra organização", day(2026, 5, 1), dayp(2026, 6, 1), uuid.Nil, uuid.New(), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := repo.HasOverlap(ctx, unitID, c.org, c.start, c.end, c.except)
			require.NoError(t, err)
			assert.Equal(t, c.wantOverlp, got)
		})
	}
}

func TestLeaseRepository_End_SóContratoAtivoENãoEstendeFim(t *testing.T) {
	ctx := context.Background()
	repo, orgID, ownerID, unitID, tenantID := newLeaseFixture(t)
	passado := time.Now().AddDate(0, -2, 0)
	l, err := repo.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, passado.AddDate(-1, 0, 0), &passado))
	require.NoError(t, err)

	ended, err := repo.End(ctx, l.ID, orgID)
	require.NoError(t, err)
	assert.Equal(t, "ENDED", ended.Status)
	assert.True(t, ended.EndDate.Before(time.Now().AddDate(0, -1, 0)), "fim anterior a hoje não é esticado")

	_, err = repo.End(ctx, l.ID, orgID)
	assert.ErrorIs(t, err, lease.ErrLeaseNotActive)
}

func TestReadjustmentRepository_CriaELista(t *testing.T) {
	ctx := context.Background()
	database := testDB(t)
	orgID, ownerID := seedOrgAndUser(t, database)
	unitID := seedUnit(t, database, seedProperty(t, database, orgID, ownerID))
	tenantID := seedTenant(t, database, orgID, ownerID)
	leases := lease.NewRepository(database)
	readj := lease.NewReadjustmentRepository(database)

	l, err := leases.Create(ctx, orgID, ownerID, leaseIn(unitID, tenantID, day(2026, 1, 1), nil))
	require.NoError(t, err)

	idx := "IGPM"
	created, err := readj.Create(ctx, &lease.Readjustment{
		LeaseID: l.ID, OrganizationID: orgID, AppliedAt: day(2026, 6, 1),
		OldAmount: 1000, NewAmount: 1050, Percentage: 0.05, IndexName: &idx,
	})
	require.NoError(t, err)
	assert.Equal(t, orgID, created.OrganizationID)

	list, err := readj.ListByLease(ctx, l.ID, orgID)
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, 1050.0, list[0].NewAmount)

	other, err := readj.ListByLease(ctx, l.ID, uuid.New())
	require.NoError(t, err)
	assert.Empty(t, other, "outra organização não vê o histórico")
}

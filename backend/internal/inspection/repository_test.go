package inspection_test

import (
	"context"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/inspection"
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
		d.Pool.Exec(context.Background(), "TRUNCATE inspection_photos, inspection_items, inspections, organization_members, leases, tenants, units, properties, organizations, users RESTART IDENTITY CASCADE")
		d.Close()
	})
	return d
}

// seed cria organização, usuário, imóvel, unidade, inquilino e contrato.
func seed(t *testing.T, d *db.DB) (orgID, leaseID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	sfx := uuid.New().String()[:8]
	var userID, propID, unitID, tenantID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO organizations (name) VALUES ($1) RETURNING id`, "Org "+sfx).Scan(&orgID))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO users (email, password_hash, organization_id) VALUES ($1,'h',$2) RETURNING id`, "insp-"+sfx+"@t.com", orgID).Scan(&userID))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO properties (organization_id, owner_id, type, name) VALUES ($1,$2,'RESIDENTIAL','P') RETURNING id`, orgID, userID).Scan(&propID))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO units (property_id, label) VALUES ($1,'U1') RETURNING id`, propID).Scan(&unitID))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO tenants (organization_id, owner_id, name) VALUES ($1,$2,'T') RETURNING id`, orgID, userID).Scan(&tenantID))
	require.NoError(t, d.Pool.QueryRow(ctx, `INSERT INTO leases (organization_id, owner_id, unit_id, tenant_id, start_date, rent_amount) VALUES ($1,$2,$3,$4,'2026-01-01',1000) RETURNING id`, orgID, userID, unitID, tenantID).Scan(&leaseID))
	return orgID, leaseID
}

func newInsp(t *testing.T, r inspection.Repository, org, lease uuid.UUID, typ string) *inspection.Inspection {
	t.Helper()
	i, err := r.Create(context.Background(), org, inspection.CreateInspectionInput{LeaseID: lease, Type: typ, InspectedAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)})
	require.NoError(t, err)
	return i
}

func TestRepository_CreateEGet(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	notes := "sem avarias"

	i, err := r.Create(ctx, org, inspection.CreateInspectionInput{LeaseID: lease, Type: inspection.TypeEntry, InspectedAt: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC), GeneralNotes: &notes})
	require.NoError(t, err)
	assert.Equal(t, inspection.StatusDraft, i.Status)
	assert.Nil(t, i.CompletedAt)

	got, err := r.GetByID(ctx, i.ID, org)
	require.NoError(t, err)
	assert.Equal(t, "sem avarias", *got.GeneralNotes)

	_, err = r.GetByID(ctx, i.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound, "outra organização não enxerga")
}

func TestRepository_UnicidadePorTipo(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	first := newInsp(t, r, org, lease, inspection.TypeEntry)

	_, err := r.Create(ctx, org, inspection.CreateInspectionInput{LeaseID: lease, Type: inspection.TypeEntry, InspectedAt: time.Now()})
	assert.ErrorIs(t, err, inspection.ErrDuplicate)

	newInsp(t, r, org, lease, inspection.TypeExit) // outro tipo convive

	require.NoError(t, r.Delete(ctx, first.ID, org))
	_, err = r.Create(ctx, org, inspection.CreateInspectionInput{LeaseID: lease, Type: inspection.TypeEntry, InspectedAt: time.Now()})
	assert.NoError(t, err, "soft-delete libera o tipo")
}

func TestRepository_UnicidadeEmCriaçõesSimultâneas(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)

	const n = 6
	errs := make(chan error, n)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := r.Create(ctx, org, inspection.CreateInspectionInput{LeaseID: lease, Type: inspection.TypeEntry, InspectedAt: time.Now()})
			errs <- err
		}()
	}
	close(start)
	wg.Wait()
	close(errs)
	ok, dup := 0, 0
	for err := range errs {
		switch {
		case err == nil:
			ok++
		case assert.ErrorIs(t, err, inspection.ErrDuplicate):
			dup++
		}
	}
	assert.Equal(t, 1, ok)
	assert.Equal(t, n-1, dup)
}

func TestRepository_List_FiltrosEIsolamento(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	otherOrg, otherLease := seed(t, d)
	r := inspection.NewRepository(d)
	entry := newInsp(t, r, org, lease, inspection.TypeEntry)
	newInsp(t, r, org, lease, inspection.TypeExit)
	newInsp(t, r, otherOrg, otherLease, inspection.TypeEntry)

	all, err := r.List(ctx, org, inspection.Filter{})
	require.NoError(t, err)
	assert.Len(t, all, 2)

	byType, _ := r.List(ctx, org, inspection.Filter{Type: inspection.TypeEntry})
	require.Len(t, byType, 1)
	assert.Equal(t, entry.ID, byType[0].ID)

	byLease, _ := r.List(ctx, org, inspection.Filter{LeaseID: &lease})
	assert.Len(t, byLease, 2)
	byOtherLease, _ := r.List(ctx, org, inspection.Filter{LeaseID: &otherLease})
	assert.Empty(t, byOtherLease, "contrato de outra organização não vaza")

	drafts, _ := r.List(ctx, org, inspection.Filter{Status: inspection.StatusDraft})
	assert.Len(t, drafts, 2)
	done, _ := r.List(ctx, org, inspection.Filter{Status: inspection.StatusCompleted})
	assert.Empty(t, done)
}

func TestRepository_CompleteEImutabilidade(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)

	at := time.Date(2026, 3, 2, 10, 0, 0, 0, time.UTC)
	done, err := r.Complete(ctx, i.ID, org, at)
	require.NoError(t, err)
	assert.Equal(t, inspection.StatusCompleted, done.Status)
	require.NotNil(t, done.CompletedAt)

	_, err = r.Complete(ctx, i.ID, org, at)
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
	_, err = r.Update(ctx, i.ID, org, inspection.UpdateInspectionInput{InspectedAt: at})
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
	_, err = r.Update(ctx, uuid.New(), org, inspection.UpdateInspectionInput{InspectedAt: at})
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	_, err = r.Complete(ctx, i.ID, uuid.New(), at)
	assert.ErrorIs(t, err, apierr.ErrNotFound, "outra organização")
}

func TestRepository_Update_Draft(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	n := "novas notas"
	up, err := r.Update(ctx, i.ID, org, inspection.UpdateInspectionInput{InspectedAt: time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC), GeneralNotes: &n})
	require.NoError(t, err)
	assert.Equal(t, "novas notas", *up.GeneralNotes)
	assert.Equal(t, 4, int(up.InspectedAt.Month()))
}

func TestRepository_ExclusãoLógica(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)

	assert.ErrorIs(t, r.Delete(ctx, i.ID, uuid.New()), apierr.ErrNotFound)
	require.NoError(t, r.Delete(ctx, i.ID, org))
	_, err := r.GetByID(ctx, i.ID, org)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	list, _ := r.List(ctx, org, inspection.Filter{})
	assert.Empty(t, list)

	var active bool
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT is_active FROM inspections WHERE id=$1`, i.ID).Scan(&active))
	assert.False(t, active, "linha preservada, só inativa")
}

func TestRepository_Itens_CRUDEIsolamento(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	otherOrg, _ := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	notes := "arranhões"

	a, err := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionFair, Notes: &notes})
	require.NoError(t, err)
	b, err := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Cozinha", Item: "Pia", Condition: inspection.ConditionGood})
	require.NoError(t, err)
	assert.Less(t, a.Position, b.Position, "posição sequencial quando omitida")

	items, err := r.ListItems(ctx, i.ID, org)
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, a.ID, items[0].ID)

	up, err := r.UpdateItem(ctx, a.ID, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionPoor})
	require.NoError(t, err)
	assert.Equal(t, inspection.ConditionPoor, up.Condition)

	// outra organização não cria, lista, edita nem remove
	_, err = r.CreateItem(ctx, i.ID, otherOrg, inspection.ItemInput{Room: "X", Item: "Y", Condition: inspection.ConditionGood})
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	other, err := r.ListItems(ctx, i.ID, otherOrg)
	require.NoError(t, err)
	assert.Empty(t, other)
	_, err = r.UpdateItem(ctx, a.ID, i.ID, otherOrg, inspection.ItemInput{Room: "X", Item: "Y", Condition: inspection.ConditionGood})
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.ErrorIs(t, r.DeleteItem(ctx, a.ID, i.ID, otherOrg), apierr.ErrNotFound)

	require.NoError(t, r.DeleteItem(ctx, a.ID, i.ID, org))
	items, _ = r.ListItems(ctx, i.ID, org)
	assert.Len(t, items, 1)
	assert.ErrorIs(t, r.DeleteItem(ctx, a.ID, i.ID, org), apierr.ErrNotFound, "já removido")
}

func TestRepository_Itens_ConstraintDeCondição(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	_, err := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: "BROKEN"})
	assert.Error(t, err, "o CHECK do banco barra condição desconhecida")
}

func TestRepository_CopyItems(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	otherOrg, _ := seed(t, d)
	r := inspection.NewRepository(d)
	entry := newInsp(t, r, org, lease, inspection.TypeEntry)
	exit := newInsp(t, r, org, lease, inspection.TypeExit)
	_, _ = r.CreateItem(ctx, entry.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionGood})
	gone, _ := r.CreateItem(ctx, entry.ID, org, inspection.ItemInput{Room: "Sala", Item: "Janela", Condition: inspection.ConditionGood})
	require.NoError(t, r.DeleteItem(ctx, gone.ID, entry.ID, org))

	n, err := r.CopyItems(ctx, entry.ID, exit.ID, org)
	require.NoError(t, err)
	assert.Equal(t, 1, n, "só os itens ativos")
	copied, _ := r.ListItems(ctx, exit.ID, org)
	require.Len(t, copied, 1)
	assert.Equal(t, "Piso", copied[0].Item)
	assert.NotEqual(t, entry.ID, copied[0].InspectionID)

	_, err = r.CopyItems(ctx, entry.ID, exit.ID, otherOrg)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestRepository_GetActiveByLeaseAndType(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	_, err := r.GetActiveByLeaseAndType(ctx, lease, org, inspection.TypeEntry)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	got, err := r.GetActiveByLeaseAndType(ctx, lease, org, inspection.TypeEntry)
	require.NoError(t, err)
	assert.Equal(t, i.ID, got.ID)
	_, err = r.GetActiveByLeaseAndType(ctx, lease, uuid.New(), inspection.TypeEntry)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func photoIn(path string) inspection.NewPhoto {
	return inspection.NewPhoto{Filename: "f.jpg", MimeType: "image/jpeg", SizeBytes: 1234, FilePath: path}
}

func TestRepository_Fotos_CRUDEIsolamento(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	otherOrg, _ := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	it, err := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionGood})
	require.NoError(t, err)
	var userID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&userID))

	p, err := r.CreatePhoto(ctx, i.ID, it.ID, org, userID, photoIn("org/a.jpg"))
	require.NoError(t, err)
	assert.Equal(t, it.ID, p.ItemID)

	list, err := r.ListPhotos(ctx, i.ID, org)
	require.NoError(t, err)
	require.Len(t, list, 1)

	pf, err := r.GetPhotoFile(ctx, p.ID, org)
	require.NoError(t, err)
	assert.Equal(t, "org/a.jpg", pf.FilePath)

	// outra organização: nada vaza e nada escreve
	_, err = r.CreatePhoto(ctx, i.ID, it.ID, otherOrg, userID, photoIn("x"))
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	empty, err := r.ListPhotos(ctx, i.ID, otherOrg)
	require.NoError(t, err)
	assert.Empty(t, empty)
	_, err = r.GetPhotoFile(ctx, p.ID, otherOrg)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.ErrorIs(t, r.DeletePhoto(ctx, p.ID, it.ID, i.ID, otherOrg), apierr.ErrNotFound)

	// o item precisa ser do laudo informado
	assert.ErrorIs(t, r.DeletePhoto(ctx, p.ID, it.ID, uuid.New(), org), apierr.ErrNotFound)

	require.NoError(t, r.DeletePhoto(ctx, p.ID, it.ID, i.ID, org))
	list, _ = r.ListPhotos(ctx, i.ID, org)
	assert.Empty(t, list)
	_, err = r.GetPhotoFile(ctx, p.ID, org)
	assert.ErrorIs(t, err, apierr.ErrNotFound)

	var active bool
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT is_active FROM inspection_photos WHERE id=$1`, p.ID).Scan(&active))
	assert.False(t, active, "linha preservada, só inativa")
}

func TestRepository_Fotos_ItemRemovidoEsconde(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	it, _ := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionGood})
	var userID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&userID))
	p, err := r.CreatePhoto(ctx, i.ID, it.ID, org, userID, photoIn("a"))
	require.NoError(t, err)

	require.NoError(t, r.DeleteItem(ctx, it.ID, i.ID, org))
	list, _ := r.ListPhotos(ctx, i.ID, org)
	assert.Empty(t, list)
	_, err = r.GetPhotoFile(ctx, p.ID, org)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	_, err = r.CreatePhoto(ctx, i.ID, it.ID, org, userID, photoIn("b"))
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestRepository_Fotos_LimiteComUploadsSimultâneos(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	it, _ := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionGood})
	var userID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&userID))

	const n = inspection.MaxPhotosPerItem + 6
	results := make(chan error, n)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for k := 0; k < n; k++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, err := r.CreatePhoto(ctx, i.ID, it.ID, org, userID, photoIn("p"))
			results <- err
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	ok, limit := 0, 0
	for err := range results {
		switch {
		case err == nil:
			ok++
		case assert.ErrorIs(t, err, inspection.ErrPhotoLimit):
			limit++
		}
	}
	assert.Equal(t, inspection.MaxPhotosPerItem, ok, "o limite vale mesmo com uploads simultâneos")
	assert.Equal(t, n-inspection.MaxPhotosPerItem, limit)
}

func TestRepository_Fotos_ConstraintDeTipo(t *testing.T) {
	ctx := context.Background()
	d := testDB(t)
	org, lease := seed(t, d)
	r := inspection.NewRepository(d)
	i := newInsp(t, r, org, lease, inspection.TypeEntry)
	it, _ := r.CreateItem(ctx, i.ID, org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionGood})
	var userID uuid.UUID
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&userID))
	bad := photoIn("a")
	bad.MimeType = "application/pdf"
	_, err := r.CreatePhoto(ctx, i.ID, it.ID, org, userID, bad)
	assert.Error(t, err, "o CHECK do banco barra tipo fora de JPEG/PNG/WebP")
}

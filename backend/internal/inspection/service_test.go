package inspection_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/inspection"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/validator"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---- mocks locais ----

type mockRepo struct {
	insp  map[uuid.UUID]*inspection.Inspection
	items map[uuid.UUID]*inspection.Item
}

func newMockRepo() *mockRepo {
	return &mockRepo{insp: map[uuid.UUID]*inspection.Inspection{}, items: map[uuid.UUID]*inspection.Item{}}
}

func (m *mockRepo) Create(_ context.Context, orgID uuid.UUID, in inspection.CreateInspectionInput) (*inspection.Inspection, error) {
	for _, i := range m.insp {
		if i.IsActive && i.OrganizationID == orgID && i.LeaseID == in.LeaseID && i.Type == in.Type {
			return nil, inspection.ErrDuplicate
		}
	}
	i := &inspection.Inspection{
		ID: uuid.New(), OrganizationID: orgID, LeaseID: in.LeaseID, Type: in.Type, Status: inspection.StatusDraft,
		InspectedAt: in.InspectedAt, GeneralNotes: in.GeneralNotes, IsActive: true,
	}
	m.insp[i.ID] = i
	return i, nil
}

func (m *mockRepo) GetByID(_ context.Context, id, orgID uuid.UUID) (*inspection.Inspection, error) {
	i, ok := m.insp[id]
	if !ok || !i.IsActive || i.OrganizationID != orgID {
		return nil, apierr.ErrNotFound
	}
	cp := *i
	return &cp, nil
}

func (m *mockRepo) GetActiveByLeaseAndType(_ context.Context, leaseID, orgID uuid.UUID, typ string) (*inspection.Inspection, error) {
	for _, i := range m.insp {
		if i.IsActive && i.OrganizationID == orgID && i.LeaseID == leaseID && i.Type == typ {
			cp := *i
			return &cp, nil
		}
	}
	return nil, apierr.ErrNotFound
}

func (m *mockRepo) List(_ context.Context, orgID uuid.UUID, f inspection.Filter) ([]inspection.Inspection, error) {
	var out []inspection.Inspection
	for _, i := range m.insp {
		if !i.IsActive || i.OrganizationID != orgID {
			continue
		}
		if f.LeaseID != nil && i.LeaseID != *f.LeaseID {
			continue
		}
		if f.Type != "" && i.Type != f.Type {
			continue
		}
		if f.Status != "" && i.Status != f.Status {
			continue
		}
		out = append(out, *i)
	}
	return out, nil
}

func (m *mockRepo) Update(_ context.Context, id, orgID uuid.UUID, in inspection.UpdateInspectionInput) (*inspection.Inspection, error) {
	i, ok := m.insp[id]
	if !ok || !i.IsActive || i.OrganizationID != orgID {
		return nil, apierr.ErrNotFound
	}
	if i.Status != inspection.StatusDraft {
		return nil, inspection.ErrNotEditable
	}
	i.InspectedAt, i.GeneralNotes = in.InspectedAt, in.GeneralNotes
	cp := *i
	return &cp, nil
}

func (m *mockRepo) Delete(_ context.Context, id, orgID uuid.UUID) error {
	i, ok := m.insp[id]
	if !ok || !i.IsActive || i.OrganizationID != orgID {
		return apierr.ErrNotFound
	}
	i.IsActive = false
	return nil
}

func (m *mockRepo) Complete(_ context.Context, id, orgID uuid.UUID, at time.Time) (*inspection.Inspection, error) {
	i, ok := m.insp[id]
	if !ok || !i.IsActive || i.OrganizationID != orgID {
		return nil, apierr.ErrNotFound
	}
	if i.Status != inspection.StatusDraft {
		return nil, inspection.ErrNotEditable
	}
	i.Status, i.CompletedAt = inspection.StatusCompleted, &at
	cp := *i
	return &cp, nil
}

func (m *mockRepo) owns(inspID, orgID uuid.UUID) bool {
	i, ok := m.insp[inspID]
	return ok && i.IsActive && i.OrganizationID == orgID
}

func (m *mockRepo) ListItems(_ context.Context, inspID, orgID uuid.UUID) ([]inspection.Item, error) {
	if !m.owns(inspID, orgID) {
		return nil, apierr.ErrNotFound
	}
	var out []inspection.Item
	for _, it := range m.items {
		if it.InspectionID == inspID && it.IsActive {
			out = append(out, *it)
		}
	}
	return out, nil
}

func (m *mockRepo) CreateItem(_ context.Context, inspID, orgID uuid.UUID, in inspection.ItemInput) (*inspection.Item, error) {
	if !m.owns(inspID, orgID) {
		return nil, apierr.ErrNotFound
	}
	it := &inspection.Item{ID: uuid.New(), InspectionID: inspID, Room: in.Room, Item: in.Item, Condition: in.Condition, Notes: in.Notes, Position: in.Position, IsActive: true}
	m.items[it.ID] = it
	return it, nil
}

func (m *mockRepo) UpdateItem(_ context.Context, id, inspID, orgID uuid.UUID, in inspection.ItemInput) (*inspection.Item, error) {
	it, ok := m.items[id]
	if !ok || !it.IsActive || it.InspectionID != inspID || !m.owns(inspID, orgID) {
		return nil, apierr.ErrNotFound
	}
	it.Room, it.Item, it.Condition, it.Notes = in.Room, in.Item, in.Condition, in.Notes
	cp := *it
	return &cp, nil
}

func (m *mockRepo) DeleteItem(_ context.Context, id, inspID, orgID uuid.UUID) error {
	it, ok := m.items[id]
	if !ok || !it.IsActive || it.InspectionID != inspID || !m.owns(inspID, orgID) {
		return apierr.ErrNotFound
	}
	it.IsActive = false
	return nil
}

func (m *mockRepo) CopyItems(_ context.Context, fromID, toID, orgID uuid.UUID) (int, error) {
	if !m.owns(fromID, orgID) || !m.owns(toID, orgID) {
		return 0, apierr.ErrNotFound
	}
	n := 0
	for _, it := range m.items {
		if it.InspectionID == fromID && it.IsActive {
			cp := &inspection.Item{ID: uuid.New(), InspectionID: toID, Room: it.Room, Item: it.Item, Condition: it.Condition, Notes: it.Notes, Position: it.Position, IsActive: true}
			m.items[cp.ID] = cp
			n++
		}
	}
	return n, nil
}

type fakeLeases struct{ known map[uuid.UUID]uuid.UUID } // leaseID -> orgID

func (f *fakeLeases) GetByID(_ context.Context, id, orgID uuid.UUID) (*lease.Lease, error) {
	if f.known[id] != orgID {
		return nil, apierr.ErrNotFound
	}
	return &lease.Lease{ID: id, OrganizationID: orgID}, nil
}

type fakeAuditor struct {
	events []string
	owners []uuid.UUID
}

func (f *fakeAuditor) LogCreate(_ context.Context, owner uuid.UUID, et string, _ uuid.UUID, _ uuid.UUID, _ string) {
	f.events = append(f.events, "create:"+et)
	f.owners = append(f.owners, owner)
}
func (f *fakeAuditor) LogUpdate(_ context.Context, owner uuid.UUID, et string, _ uuid.UUID, _ uuid.UUID, _ string) {
	f.events = append(f.events, "update:"+et)
	f.owners = append(f.owners, owner)
}

type env struct {
	svc     *inspection.Service
	repo    *mockRepo
	auditor *fakeAuditor
	org     uuid.UUID
	user    uuid.UUID
	lease   uuid.UUID
}

func newEnv() *env {
	e := &env{repo: newMockRepo(), auditor: &fakeAuditor{}, org: uuid.New(), user: uuid.New(), lease: uuid.New()}
	e.svc = inspection.NewService(e.repo, &fakeLeases{known: map[uuid.UUID]uuid.UUID{e.lease: e.org}}).WithAuditor(e.auditor)
	return e
}

func (e *env) create(t *testing.T, typ string, copyFrom bool) *inspection.Detail {
	t.Helper()
	d, err := e.svc.Create(context.Background(), e.org, e.user, inspection.CreateInspectionInput{
		LeaseID: e.lease, Type: typ, InspectedAt: time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC), CopyFromEntry: copyFrom,
	})
	require.NoError(t, err)
	return d
}

func (e *env) item(t *testing.T, id uuid.UUID, room, item, cond string) *inspection.Item {
	t.Helper()
	it, err := e.svc.AddItem(context.Background(), id, e.org, inspection.ItemInput{Room: room, Item: item, Condition: cond})
	require.NoError(t, err)
	return it
}

// ---- criar ----

func TestService_Create_Sucesso(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	assert.Equal(t, inspection.StatusDraft, d.Status)
	assert.Equal(t, e.org, d.OrganizationID)
	assert.Empty(t, d.Items)
	assert.NotNil(t, d.Items, "itens nunca nil")
}

func TestService_Create_ContratoDeOutraOrganização(t *testing.T) {
	e := newEnv()
	_, err := e.svc.Create(context.Background(), uuid.New(), e.user, inspection.CreateInspectionInput{
		LeaseID: e.lease, Type: inspection.TypeEntry, InspectedAt: time.Now(),
	})
	assert.ErrorIs(t, err, inspection.ErrLeaseNotFound)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.Empty(t, e.repo.insp)
}

func TestService_Create_ContratoInexistente(t *testing.T) {
	e := newEnv()
	_, err := e.svc.Create(context.Background(), e.org, e.user, inspection.CreateInspectionInput{
		LeaseID: uuid.New(), Type: inspection.TypeEntry, InspectedAt: time.Now(),
	})
	assert.ErrorIs(t, err, inspection.ErrLeaseNotFound)
}

func TestService_Create_DuplicadoPorTipo(t *testing.T) {
	e := newEnv()
	e.create(t, inspection.TypeEntry, false)
	_, err := e.svc.Create(context.Background(), e.org, e.user, inspection.CreateInspectionInput{
		LeaseID: e.lease, Type: inspection.TypeEntry, InspectedAt: time.Now(),
	})
	assert.ErrorIs(t, err, inspection.ErrDuplicate)
	assert.ErrorIs(t, err, apierr.ErrConflict)
}

func TestService_Create_EntradaESaídaConvivem(t *testing.T) {
	e := newEnv()
	e.create(t, inspection.TypeEntry, false)
	_, err := e.svc.Create(context.Background(), e.org, e.user, inspection.CreateInspectionInput{
		LeaseID: e.lease, Type: inspection.TypeExit, InspectedAt: time.Now(),
	})
	assert.NoError(t, err)
}

func TestService_Create_ExcluídoLiberaTipo(t *testing.T) {
	e := newEnv()
	first := e.create(t, inspection.TypeEntry, false)
	require.NoError(t, e.svc.Delete(context.Background(), first.ID, e.org))
	_, err := e.svc.Create(context.Background(), e.org, e.user, inspection.CreateInspectionInput{
		LeaseID: e.lease, Type: inspection.TypeEntry, InspectedAt: time.Now(),
	})
	assert.NoError(t, err)
}

func TestInputs_Validate(t *testing.T) {
	ok := inspection.CreateInspectionInput{LeaseID: uuid.New(), Type: "ENTRY", InspectedAt: time.Now()}
	assert.NoError(t, validator.Validate(ok))

	bad := ok
	bad.Type = "OUTRO"
	assert.Error(t, validator.Validate(bad), "tipo fora de ENTRY/EXIT")

	noDate := ok
	noDate.InspectedAt = time.Time{}
	assert.Error(t, validator.Validate(noDate), "data obrigatória")

	long := strings.Repeat("a", 4001)
	notes := ok
	notes.GeneralNotes = &long
	assert.Error(t, validator.Validate(notes))

	item := inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: "GOOD"}
	assert.NoError(t, validator.Validate(item))
	for _, c := range []string{"", "BROKEN", "good"} {
		item.Condition = c
		assert.Error(t, validator.Validate(item), "condição %q", c)
	}
	assert.Error(t, validator.Validate(inspection.ItemInput{Item: "Piso", Condition: "GOOD"}), "ambiente obrigatório")
	assert.Error(t, validator.Validate(inspection.ItemInput{Room: "Sala", Condition: "GOOD"}), "item obrigatório")
	assert.Error(t, validator.Validate(inspection.ItemInput{Room: strings.Repeat("a", 101), Item: "Piso", Condition: "GOOD"}))
}

func TestService_Create_Auditoria(t *testing.T) {
	e := newEnv()
	e.create(t, inspection.TypeEntry, false)
	assert.Equal(t, []string{"create:inspection"}, e.auditor.events)
	assert.Equal(t, e.user, e.auditor.owners[0], "owner da auditoria é o usuário (FK para users)")
}

// ---- copiar da entrada ----

func TestService_Create_CopiaItensDaEntrada(t *testing.T) {
	e := newEnv()
	entry := e.create(t, inspection.TypeEntry, false)
	e.item(t, entry.ID, "Sala", "Piso", inspection.ConditionGood)
	e.item(t, entry.ID, "Cozinha", "Pia", inspection.ConditionFair)

	exit := e.create(t, inspection.TypeExit, true)
	assert.Len(t, exit.Items, 2)
	for _, it := range exit.Items {
		assert.NotEqual(t, entry.ID, it.InspectionID)
	}
}

func TestService_Create_CopiaSemEntradaCriaVazio(t *testing.T) {
	e := newEnv()
	exit := e.create(t, inspection.TypeExit, true)
	assert.Empty(t, exit.Items)
}

func TestService_Create_CopyFromEntryIgnoradoNaEntrada(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, true)
	assert.Empty(t, d.Items)
}

// ---- itens e edição ----

func TestService_AddItem_EmLaudoDraft(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	it := e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	assert.Equal(t, "Sala", it.Room)
	got, err := e.svc.Get(context.Background(), d.ID, e.org)
	require.NoError(t, err)
	assert.Len(t, got.Items, 1)
}

func TestService_EdiçãoAposConclusão(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	it := e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	_, err := e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	require.NoError(t, err)

	_, err = e.svc.AddItem(context.Background(), d.ID, e.org, inspection.ItemInput{Room: "Quarto", Item: "Porta", Condition: inspection.ConditionGood})
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
	_, err = e.svc.UpdateItem(context.Background(), it.ID, d.ID, e.org, inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionPoor})
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
	assert.ErrorIs(t, e.svc.DeleteItem(context.Background(), it.ID, d.ID, e.org), inspection.ErrNotEditable)
	_, err = e.svc.Update(context.Background(), d.ID, e.org, inspection.UpdateInspectionInput{InspectedAt: time.Now()})
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
}

func TestService_Item_ExclusãoLógica(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	it := e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	require.NoError(t, e.svc.DeleteItem(context.Background(), it.ID, d.ID, e.org))
	got, _ := e.svc.Get(context.Background(), d.ID, e.org)
	assert.Empty(t, got.Items)
}

func TestService_Item_OutraOrganização(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	_, err := e.svc.AddItem(context.Background(), d.ID, uuid.New(), inspection.ItemInput{Room: "Sala", Item: "Piso", Condition: inspection.ConditionGood})
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_Update_Draft(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	notes := "tudo limpo"
	got, err := e.svc.Update(context.Background(), d.ID, e.org, inspection.UpdateInspectionInput{InspectedAt: time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC), GeneralNotes: &notes})
	require.NoError(t, err)
	assert.Equal(t, "tudo limpo", *got.GeneralNotes)
}

// ---- concluir ----

func TestService_Complete_SemItens(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	_, err := e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	assert.ErrorIs(t, err, inspection.ErrNoItems)
	got, _ := e.svc.Get(context.Background(), d.ID, e.org)
	assert.Equal(t, inspection.StatusDraft, got.Status)
}

func TestService_Complete_Sucesso(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	got, err := e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	require.NoError(t, err)
	assert.Equal(t, inspection.StatusCompleted, got.Status)
	require.NotNil(t, got.CompletedAt)
	assert.Equal(t, []string{"create:inspection", "update:inspection"}, e.auditor.events)
}

func TestService_Complete_Repetido(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	_, err := e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	require.NoError(t, err)
	_, err = e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	assert.ErrorIs(t, err, inspection.ErrNotEditable)
}

// ---- listar / excluir ----

func TestService_List_FiltrosEIsolamento(t *testing.T) {
	e := newEnv()
	e.create(t, inspection.TypeEntry, false)
	e.create(t, inspection.TypeExit, false)

	all, err := e.svc.List(context.Background(), e.org, inspection.Filter{})
	require.NoError(t, err)
	assert.Len(t, all, 2)

	onlyExit, _ := e.svc.List(context.Background(), e.org, inspection.Filter{Type: inspection.TypeExit})
	assert.Len(t, onlyExit, 1)

	other, err := e.svc.List(context.Background(), uuid.New(), inspection.Filter{})
	require.NoError(t, err)
	assert.NotNil(t, other)
	assert.Empty(t, other)

	_, err = e.svc.List(context.Background(), e.org, inspection.Filter{Type: "XYZ"})
	assert.ErrorIs(t, err, inspection.ErrInvalidFilter)
}

func TestService_Delete_ExclusãoLógica(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	require.NoError(t, e.svc.Delete(context.Background(), d.ID, e.org))
	_, err := e.svc.Get(context.Background(), d.ID, e.org)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.False(t, e.repo.insp[d.ID].IsActive)
}

func TestService_Get_OutraOrganização(t *testing.T) {
	e := newEnv()
	d := e.create(t, inspection.TypeEntry, false)
	_, err := e.svc.Get(context.Background(), d.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

// ---- comparação ----

func completed(t *testing.T, e *env, typ string, items map[[2]string]string) {
	t.Helper()
	d := e.create(t, typ, false)
	for k, cond := range items {
		e.item(t, d.ID, k[0], k[1], cond)
	}
	_, err := e.svc.Complete(context.Background(), d.ID, e.org, e.user)
	require.NoError(t, err)
}

func rowOf(c *inspection.Comparison, room, item string) *inspection.ComparisonRow {
	for i := range c.Rows {
		if strings.EqualFold(c.Rows[i].Room, room) && strings.EqualFold(c.Rows[i].Item, item) {
			return &c.Rows[i]
		}
	}
	return nil
}

func TestService_Compare_ItemPiorou(t *testing.T) {
	e := newEnv()
	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala", "Piso"}: "GOOD", {"Cozinha", "Pia"}: "FAIR", {"Quarto", "Porta"}: "POOR"})
	completed(t, e, inspection.TypeExit, map[[2]string]string{{"Sala", "Piso"}: "DAMAGED", {"Cozinha", "Pia"}: "FAIR", {"Quarto", "Porta"}: "GOOD"})

	c, err := e.svc.Compare(context.Background(), e.lease, e.org)
	require.NoError(t, err)
	assert.True(t, rowOf(c, "Sala", "Piso").Worsened, "GOOD -> DAMAGED")
	assert.False(t, rowOf(c, "Cozinha", "Pia").Worsened, "igual")
	assert.False(t, rowOf(c, "Quarto", "Porta").Worsened, "melhorou")
}

func TestService_Compare_ItemSóDeUmLado(t *testing.T) {
	e := newEnv()
	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala", "Piso"}: "GOOD", {"Sala", "Janela"}: "GOOD"})
	completed(t, e, inspection.TypeExit, map[[2]string]string{{"Sala", "Piso"}: "GOOD", {"Sala", "Armário"}: "POOR"})

	c, err := e.svc.Compare(context.Background(), e.lease, e.org)
	require.NoError(t, err)
	janela := rowOf(c, "Sala", "Janela")
	require.NotNil(t, janela)
	assert.NotNil(t, janela.EntryCondition)
	assert.Nil(t, janela.ExitCondition)
	assert.False(t, janela.Worsened)
	armario := rowOf(c, "Sala", "Armário")
	require.NotNil(t, armario)
	assert.Nil(t, armario.EntryCondition)
	assert.False(t, armario.Worsened)
}

func TestService_Compare_ChaveNormalizada(t *testing.T) {
	e := newEnv()
	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala ", "Piso"}: "GOOD"})
	completed(t, e, inspection.TypeExit, map[[2]string]string{{"sala", " piso "}: "POOR"})

	c, err := e.svc.Compare(context.Background(), e.lease, e.org)
	require.NoError(t, err)
	require.Len(t, c.Rows, 1, "mesma chave apesar de caixa e espaços")
	assert.True(t, c.Rows[0].Worsened)
}

func TestService_Compare_NãoAplicávelNuncaPiora(t *testing.T) {
	e := newEnv()
	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala", "Piso"}: "GOOD", {"Sala", "Janela"}: "NOT_APPLICABLE"})
	completed(t, e, inspection.TypeExit, map[[2]string]string{{"Sala", "Piso"}: "NOT_APPLICABLE", {"Sala", "Janela"}: "DAMAGED"})

	c, err := e.svc.Compare(context.Background(), e.lease, e.org)
	require.NoError(t, err)
	assert.False(t, rowOf(c, "Sala", "Piso").Worsened)
	assert.False(t, rowOf(c, "Sala", "Janela").Worsened)
}

func TestService_Compare_FaltaLaudo(t *testing.T) {
	e := newEnv()
	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala", "Piso"}: "GOOD"})
	_, err := e.svc.Compare(context.Background(), e.lease, e.org)
	assert.ErrorIs(t, err, inspection.ErrComparisonUnavailable)
	assert.ErrorIs(t, err, apierr.ErrConflict)
}

func TestService_Compare_SaídaEmRascunho(t *testing.T) {
	e := newEnv()
	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala", "Piso"}: "GOOD"})
	d := e.create(t, inspection.TypeExit, false)
	e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	_, err := e.svc.Compare(context.Background(), e.lease, e.org)
	assert.ErrorIs(t, err, inspection.ErrComparisonUnavailable)
}

func TestService_Compare_ContratoDeOutraOrganização(t *testing.T) {
	e := newEnv()
	_, err := e.svc.Compare(context.Background(), e.lease, uuid.New())
	assert.ErrorIs(t, err, inspection.ErrLeaseNotFound)
}

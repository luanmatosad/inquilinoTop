package importexport

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	validCPF1 = "529.982.247-25"
	validCPF2 = "111.444.777-35"
)

// fakeTenantRepo implementa tenant.Repository; o tenant.Service real roda por cima.
type fakeTenantRepo struct {
	created   []tenant.CreateTenantInput
	userIDs   []uuid.UUID
	orgIDs    []uuid.UUID
	byDoc     map[string]*tenant.Tenant
	lookupOrg []uuid.UUID
}

func newFakeTenantRepo() *fakeTenantRepo {
	return &fakeTenantRepo{byDoc: map[string]*tenant.Tenant{}}
}

func (f *fakeTenantRepo) Create(_ context.Context, userID, orgID uuid.UUID, in tenant.CreateTenantInput) (*tenant.Tenant, error) {
	f.created = append(f.created, in)
	f.userIDs = append(f.userIDs, userID)
	f.orgIDs = append(f.orgIDs, orgID)
	t := &tenant.Tenant{ID: uuid.New(), OrganizationID: orgID, Name: in.Name, Document: in.Document}
	if in.Document != nil {
		f.byDoc[*in.Document] = t
	}
	return t, nil
}
func (f *fakeTenantRepo) GetByID(context.Context, uuid.UUID, uuid.UUID) (*tenant.Tenant, error) {
	return nil, nil
}
func (f *fakeTenantRepo) List(context.Context, uuid.UUID) ([]tenant.Tenant, error) { return nil, nil }
func (f *fakeTenantRepo) Update(context.Context, uuid.UUID, uuid.UUID, tenant.CreateTenantInput) (*tenant.Tenant, error) {
	return nil, nil
}
func (f *fakeTenantRepo) Delete(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (f *fakeTenantRepo) GetByField(_ context.Context, orgID uuid.UUID, _ string, value string) (*tenant.Tenant, error) {
	f.lookupOrg = append(f.lookupOrg, orgID)
	return f.byDoc[value], nil
}

type fakeRepo struct {
	updates   []string
	updateErr error
	failOn    string // status que provoca erro em UpdateImportHistory
	lastOwner uuid.UUID
}

func (f *fakeRepo) CreateImportHistory(_ context.Context, ownerID uuid.UUID, _, entityType string, total int) (*ImportHistory, error) {
	f.lastOwner = ownerID
	return &ImportHistory{ID: uuid.New(), OwnerID: ownerID, EntityType: entityType, TotalRows: total}, nil
}
func (f *fakeRepo) UpdateImportHistory(_ context.Context, _ uuid.UUID, _, _ int, status string) error {
	f.updates = append(f.updates, status)
	if f.failOn != "" && status == f.failOn {
		return errors.New("db down")
	}
	return f.updateErr
}
func (f *fakeRepo) ListImportHistory(context.Context, uuid.UUID) ([]ImportHistory, error) {
	return nil, nil
}

func newTestService() (*Service, *fakeRepo, *fakeTenantRepo) {
	repo := &fakeRepo{}
	tr := newFakeTenantRepo()
	return NewService(repo, tenant.NewService(tr)), repo, tr
}

func TestService_ImportRecords_TenantNovoGrava(t *testing.T) {
	svc, repo, tr := newTestService()
	owner, user, org := uuid.New(), uuid.New(), uuid.New()

	resp, err := svc.ImportRecords(context.Background(), owner, user, org, ImportRequest{
		EntityType: "tenant",
		Records: []map[string]string{{
			"name": "Maria", "cpf": validCPF1, "email": "m@x.com", "phone": "11999999999",
			"postal_code": "01310100", "city": "São Paulo", "state": "SP",
		}},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, resp.Imported)
	assert.Equal(t, 0, resp.Failed)
	assert.Equal(t, 0, resp.Skipped)

	require.Len(t, tr.created, 1)
	assert.Equal(t, user, tr.userIDs[0])
	assert.Equal(t, org, tr.orgIDs[0])
	assert.Equal(t, owner, repo.lastOwner)
	in := tr.created[0]
	assert.Equal(t, "Maria", in.Name)
	require.NotNil(t, in.Document)
	assert.Equal(t, "52998224725", *in.Document)
	require.NotNil(t, in.PersonType)
	assert.Equal(t, "PF", *in.PersonType)
	assert.Nil(t, in.Notes)
	assert.Nil(t, in.AddressLine)
	assert.Equal(t, []string{"PROCESSING", "COMPLETED"}, repo.updates)
	for _, o := range tr.lookupOrg {
		assert.Equal(t, org, o)
	}
}

func TestService_ImportRecords_CNPJVirapJ(t *testing.T) {
	svc, _, tr := newTestService()
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "tenant",
		Records:    []map[string]string{{"name": "Empresa", "cnpj": "11.222.333/0001-81"}},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, resp.Imported)
	require.Len(t, tr.created, 1)
	assert.Equal(t, "PJ", *tr.created[0].PersonType)
	assert.Equal(t, "11222333000181", *tr.created[0].Document)
}

func TestService_ImportRecords_DuplicataSkip(t *testing.T) {
	svc, _, tr := newTestService()
	org := uuid.New()
	req := ImportRequest{
		EntityType: "tenant", DuplicateStrategy: "skip",
		Records: []map[string]string{
			{"name": "A", "cpf": validCPF1},
			{"name": "A de novo", "cpf": validCPF1},
			{"name": "B", "cpf": validCPF2},
		},
	}
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), org, req)
	require.NoError(t, err)
	assert.Equal(t, 2, resp.Imported)
	assert.Equal(t, 1, resp.Skipped)
	assert.Equal(t, 0, resp.Failed)
	assert.Len(t, tr.created, 2)
}

func TestService_ImportRecords_DuplicataSemSkipFalha(t *testing.T) {
	svc, repo, _ := newTestService()
	req := ImportRequest{
		EntityType: "tenant",
		Records: []map[string]string{
			{"name": "A", "cpf": validCPF1},
			{"name": "A de novo", "cpf": validCPF1},
		},
	}
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), req)
	require.NoError(t, err)
	assert.Equal(t, 1, resp.Imported)
	assert.Equal(t, 1, resp.Failed)
	assert.Equal(t, 0, resp.Skipped)
	require.Len(t, resp.Errors, 1)
	assert.Contains(t, resp.Errors[0], "já cadastrado")
	assert.Equal(t, "COMPLETED", repo.updates[len(repo.updates)-1])
}

func TestService_ImportRecords_CPFInvalidoFalha(t *testing.T) {
	svc, _, tr := newTestService()
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "tenant",
		Records:    []map[string]string{{"name": "X", "cpf": "123.456.789-00"}},
	})
	require.NoError(t, err)
	assert.Equal(t, 0, resp.Imported)
	assert.Equal(t, 1, resp.Failed)
	assert.Empty(t, tr.created)
}

func TestService_ImportRecords_PropertyNaoSuportado(t *testing.T) {
	svc, _, _ := newTestService()
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "property",
		Records:    []map[string]string{{"name": "Casa"}},
	})
	require.NoError(t, err)
	assert.Equal(t, 0, resp.Imported)
	assert.Equal(t, 1, resp.Failed)
	require.Len(t, resp.Errors, 1)
	assert.Contains(t, resp.Errors[0], "não suportado")
}

func TestService_ImportRecords_TipoDesconhecidoFalha(t *testing.T) {
	svc, _, _ := newTestService()
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "foo",
		Records:    []map[string]string{{"a": "b"}},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, resp.Failed)
	assert.Contains(t, resp.Errors[0], "não suportado")
}

func TestService_ImportRecords_TodasFalhamStatusFailed(t *testing.T) {
	svc, repo, _ := newTestService()
	_, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "tenant",
		Records:    []map[string]string{{"name": "X", "cpf": "000"}, {"name": "Y", "cpf": "111"}},
	})
	require.NoError(t, err)
	assert.Equal(t, "FAILED", repo.updates[len(repo.updates)-1])
}

func TestService_ImportRecords_SkippedNaoContaComoFalha(t *testing.T) {
	svc, repo, tr := newTestService()
	doc := "52998224725"
	tr.byDoc[doc] = &tenant.Tenant{ID: uuid.New(), Document: &doc}
	resp, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "tenant", DuplicateStrategy: "skip",
		Records: []map[string]string{{"name": "A", "cpf": validCPF1}},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, resp.Skipped)
	assert.Equal(t, "COMPLETED", repo.updates[len(repo.updates)-1])
}

func TestService_ImportRecords_ErroUpdateHistoryFinalPropagado(t *testing.T) {
	svc, repo, _ := newTestService()
	repo.failOn = "COMPLETED"
	_, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "tenant",
		Records:    []map[string]string{{"name": "A", "cpf": validCPF1}},
	})
	require.Error(t, err)
}

func TestService_ImportRecords_ErroUpdateHistoryInicialPropagado(t *testing.T) {
	svc, repo, tr := newTestService()
	repo.failOn = "PROCESSING"
	_, err := svc.ImportRecords(context.Background(), uuid.New(), uuid.New(), uuid.New(), ImportRequest{
		EntityType: "tenant",
		Records:    []map[string]string{{"name": "A", "cpf": validCPF1}},
	})
	require.Error(t, err)
	assert.Empty(t, tr.created)
}

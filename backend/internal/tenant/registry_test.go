package tenant_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/validator"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	cpfA  = "52998224725"
	cpfB  = "11144477735"
	cnpjA = "11222333000181"
)

func sp(s string) *string { return &s }

type fakeLeaseChecker struct {
	active map[uuid.UUID]bool
	err    error
}

func (f *fakeLeaseChecker) HasActiveLease(_ context.Context, tenantID, _ uuid.UUID) (bool, error) {
	return f.active[tenantID], f.err
}

func TestCreateTenantInput_Validate_Endereço(t *testing.T) {
	base := tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF")}
	assert.NoError(t, validator.Validate(base))

	ok := base
	ok.PostalCode, ok.AddressLine, ok.City, ok.State, ok.Notes = sp("01310100"), sp("Av. Paulista, 1000"), sp("São Paulo"), sp("SP"), sp("obs")
	assert.NoError(t, validator.Validate(ok))

	for _, cep := range []string{"123", "01310-100", "abcdefgh"} {
		in := base
		in.PostalCode = sp(cep)
		assert.Error(t, validator.Validate(in), "cep %q", cep)
	}
	uf := base
	uf.State = sp("SAO")
	assert.Error(t, validator.Validate(uf))
}

func TestService_Create_CPFVálidoGravaSóDígitos(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	tn, err := svc.Create(context.Background(), uuid.New(), uuid.New(), tenant.CreateTenantInput{
		Name: "Ana", PersonType: sp("PF"), Document: sp("529.982.247-25"),
	})
	require.NoError(t, err)
	require.NotNil(t, tn.Document)
	assert.Equal(t, cpfA, *tn.Document)
}

func TestService_Create_SemDocumento(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	tn, err := svc.Create(context.Background(), uuid.New(), uuid.New(), tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp("  ")})
	require.NoError(t, err)
	assert.Nil(t, tn.Document)
}

func TestService_Create_DocumentoInválido(t *testing.T) {
	tests := []struct {
		name, person, doc string
	}{
		{"cpf dígito errado", "PF", "52998224726"},
		{"cpf repetido", "PF", "111.111.111-11"},
		{"pj com cpf", "PJ", cpfA},
		{"pf com cnpj", "PF", cnpjA},
		{"cnpj dígito errado", "PJ", "11222333000182"},
		{"lixo", "PF", "abc"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := tenant.NewService(newMockTenantRepo())
			_, err := svc.Create(context.Background(), uuid.New(), uuid.New(), tenant.CreateTenantInput{
				Name: "X", PersonType: sp(tt.person), Document: sp(tt.doc),
			})
			assert.ErrorIs(t, err, tenant.ErrInvalidDocument)
		})
	}
}

func TestService_Create_CNPJVálidoParaPJ(t *testing.T) {
	svc := tenant.NewService(newMockTenantRepo())
	tn, err := svc.Create(context.Background(), uuid.New(), uuid.New(), tenant.CreateTenantInput{
		Name: "Empresa", PersonType: sp("PJ"), Document: sp("11.222.333/0001-81"),
	})
	require.NoError(t, err)
	assert.Equal(t, cnpjA, *tn.Document)
}

func TestService_Create_DocumentoDuplicado(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	org := uuid.New()
	_, err := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})
	require.NoError(t, err)

	_, err = svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Outra Ana", PersonType: sp("PF"), Document: sp("529.982.247-25")})
	assert.ErrorIs(t, err, tenant.ErrDuplicateDocument)
	assert.ErrorIs(t, err, apierr.ErrConflict)
}

func TestService_Create_MesmoDocumentoEmOutraOrganização(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	_, err := svc.Create(ctx, uuid.New(), uuid.New(), tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})
	require.NoError(t, err)
	_, err = svc.Create(ctx, uuid.New(), uuid.New(), tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})
	assert.NoError(t, err)
}

func TestService_Create_ReusoAposExclusão(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	org := uuid.New()
	a, err := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})
	require.NoError(t, err)
	require.NoError(t, svc.Delete(ctx, a.ID, org))

	_, err = svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana 2", PersonType: sp("PF"), Document: sp(cpfA)})
	assert.NoError(t, err)
}

func TestService_Update_DocumentoDuplicado(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	org := uuid.New()
	_, err := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})
	require.NoError(t, err)
	b, err := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Bia", PersonType: sp("PF"), Document: sp(cpfB)})
	require.NoError(t, err)

	_, err = svc.Update(ctx, b.ID, org, tenant.CreateTenantInput{Name: "Bia", PersonType: sp("PF"), Document: sp(cpfA)})
	assert.ErrorIs(t, err, tenant.ErrDuplicateDocument)
}

func TestService_Update_MesmoDocumentoDoPróprioInquilino(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	org := uuid.New()
	a, err := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})
	require.NoError(t, err)

	_, err = svc.Update(ctx, a.ID, org, tenant.CreateTenantInput{Name: "Ana Maria", PersonType: sp("PF"), Document: sp("529.982.247-25")})
	assert.NoError(t, err)
}

func TestService_Update_DocumentoInválido(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	org := uuid.New()
	a, _ := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp(cpfA)})

	_, err := svc.Update(ctx, a.ID, org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF"), Document: sp("123")})
	assert.ErrorIs(t, err, tenant.ErrInvalidDocument)
}

func TestService_Delete_ComContratoAtivo(t *testing.T) {
	ctx := context.Background()
	org := uuid.New()
	repo := newMockTenantRepo()
	checker := &fakeLeaseChecker{active: map[uuid.UUID]bool{}}
	svc := tenant.NewService(repo).WithLeaseChecker(checker)

	a, err := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF")})
	require.NoError(t, err)
	checker.active[a.ID] = true

	err = svc.Delete(ctx, a.ID, org)
	assert.ErrorIs(t, err, tenant.ErrHasActiveLease)
	assert.ErrorIs(t, err, apierr.ErrConflict)
	assert.True(t, repo.tenants[a.ID].IsActive, "cadastro deve continuar ativo")
}

func TestService_Delete_SemContratoAtivo(t *testing.T) {
	ctx := context.Background()
	org := uuid.New()
	checker := &fakeLeaseChecker{active: map[uuid.UUID]bool{}}
	svc := tenant.NewService(newMockTenantRepo()).WithLeaseChecker(checker)
	a, _ := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF")})

	assert.NoError(t, svc.Delete(ctx, a.ID, org))
}

func TestService_Delete_ErroNoChecker(t *testing.T) {
	ctx := context.Background()
	org := uuid.New()
	checker := &fakeLeaseChecker{err: errors.New("db down")}
	svc := tenant.NewService(newMockTenantRepo()).WithLeaseChecker(checker)
	a, _ := svc.Create(ctx, uuid.New(), org, tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF")})

	err := svc.Delete(ctx, a.ID, org)
	require.Error(t, err)
	assert.NotErrorIs(t, err, tenant.ErrHasActiveLease)
}

func TestService_Delete_OutraOrganização(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo()).WithLeaseChecker(&fakeLeaseChecker{})
	a, _ := svc.Create(ctx, uuid.New(), uuid.New(), tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF")})

	err := svc.Delete(ctx, a.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_List_OutraOrganizaçãoVazia(t *testing.T) {
	ctx := context.Background()
	svc := tenant.NewService(newMockTenantRepo())
	_, _ = svc.Create(ctx, uuid.New(), uuid.New(), tenant.CreateTenantInput{Name: "Ana", PersonType: sp("PF")})

	list, err := svc.List(ctx, uuid.New())
	require.NoError(t, err)
	assert.Empty(t, list)
}

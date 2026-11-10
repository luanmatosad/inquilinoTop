package settings_test

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func pixSvc() (*settings.Service, *mockRepo, uuid.UUID) {
	repo := newMock()
	unit := uuid.New()
	repo.unitOrg[unit] = org
	return settings.NewService(repo), repo, unit
}

func TestPix_GetSemConfiguracao(t *testing.T) {
	svc, _, _ := pixSvc()
	p, err := svc.GetPix(context.Background(), org)
	require.NoError(t, err)
	assert.False(t, p.Default.Configured)
	assert.NotNil(t, p.Units, "lista nunca nil")
	assert.Empty(t, p.Units)
}

func TestPix_SaveNormalizaEGrava(t *testing.T) {
	svc, repo, _ := pixSvc()
	d, err := svc.SavePix(context.Background(), org, uuid.New(), settings.PixInput{KeyType: "CPF", Key: "529.982.247-25", ReceiverName: " Luan Matos ", City: " Manaus "})
	require.NoError(t, err)
	assert.Equal(t, settings.PixDefault{Configured: true, KeyType: "CPF", Key: "52998224725", ReceiverName: "Luan Matos", City: "Manaus"}, *d)
	assert.Equal(t, "52998224725", repo.pixDefault[org].Key)
}

func TestPix_SaveRecusaInvalidoENadaGrava(t *testing.T) {
	svc, repo, _ := pixSvc()
	_, err := svc.SavePix(context.Background(), org, uuid.New(), settings.PixInput{KeyType: "CPF", Key: "111.111.111-11"})
	assert.ErrorIs(t, err, settings.ErrInvalidPixKey)
	_, err = svc.SavePix(context.Background(), org, uuid.New(), settings.PixInput{KeyType: "EMAIL", Key: "a@b.com", ReceiverName: strings.Repeat("x", 26)})
	assert.ErrorIs(t, err, settings.ErrInvalidPix)
	assert.Empty(t, repo.pixDefault)
}

func TestPix_NomeECidadeOpcionais(t *testing.T) {
	svc, _, _ := pixSvc()
	d, err := svc.SavePix(context.Background(), org, uuid.New(), settings.PixInput{KeyType: "EMAIL", Key: "Voce@Email.com"})
	require.NoError(t, err)
	assert.Equal(t, "voce@email.com", d.Key)
	assert.Empty(t, d.ReceiverName)
}

func TestPix_UnidadeExigeConfirmacao(t *testing.T) {
	svc, repo, unit := pixSvc()
	in := settings.UnitPixInput{KeyType: "CNPJ", Key: "11.222.333/0001-81", ReceiverName: "Centro Empresarial Ltda", Confirmed: false}
	_, err := svc.SaveUnitPix(context.Background(), org, unit, uuid.New(), in)
	assert.ErrorIs(t, err, settings.ErrConfirmationRequired)
	assert.Empty(t, repo.unitPix, "sem confirmação nada é gravado")

	// a confirmação é conferida antes da chave: não vaza se a chave estava certa
	_, err = svc.SaveUnitPix(context.Background(), org, unit, uuid.New(), settings.UnitPixInput{KeyType: "CPF", Key: "lixo", Confirmed: false})
	assert.ErrorIs(t, err, settings.ErrConfirmationRequired)
}

func TestPix_UnidadeGravaComAutor(t *testing.T) {
	svc, repo, unit := pixSvc()
	user := uuid.New()
	u, err := svc.SaveUnitPix(context.Background(), org, unit, user, settings.UnitPixInput{KeyType: "CNPJ", Key: "11.222.333/0001-81", ReceiverName: "Centro Empresarial Ltda", Confirmed: true})
	require.NoError(t, err)
	assert.Equal(t, "11222333000181", u.Key)
	assert.Equal(t, user, repo.confirmers[unit], "quem confirmou fica registrado")
}

func TestPix_UnidadeInvalidaOuDeOutraOrganizacao(t *testing.T) {
	svc, repo, unit := pixSvc()
	_, err := svc.SaveUnitPix(context.Background(), org, unit, uuid.New(), settings.UnitPixInput{KeyType: "CPF", Key: "123", Confirmed: true})
	assert.ErrorIs(t, err, settings.ErrInvalidPixKey)

	_, err = svc.SaveUnitPix(context.Background(), org, unit, uuid.New(), settings.UnitPixInput{KeyType: "EMAIL", Key: "a@b.com", ReceiverName: strings.Repeat("n", 26), Confirmed: true})
	assert.ErrorIs(t, err, settings.ErrInvalidPix)

	outra := uuid.New() // unidade de outra organização
	repo.unitOrg[outra] = uuid.New()
	_, err = svc.SaveUnitPix(context.Background(), org, outra, uuid.New(), settings.UnitPixInput{KeyType: "EMAIL", Key: "a@b.com", Confirmed: true})
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.Empty(t, repo.unitPix)
}

func TestPix_RemoverContaDaUnidade(t *testing.T) {
	svc, repo, unit := pixSvc()
	assert.ErrorIs(t, svc.RemoveUnitPix(context.Background(), org, unit), apierr.ErrNotFound, "sem conta ativa")
	_, err := svc.SaveUnitPix(context.Background(), org, unit, uuid.New(), settings.UnitPixInput{KeyType: "EMAIL", Key: "a@b.com", Confirmed: true})
	require.NoError(t, err)
	require.NoError(t, svc.RemoveUnitPix(context.Background(), org, unit))
	assert.Empty(t, repo.unitPix)
}

func TestPix_ListaIncluiAsContasDasUnidades(t *testing.T) {
	svc, _, unit := pixSvc()
	_, _ = svc.SavePix(context.Background(), org, uuid.New(), settings.PixInput{KeyType: "EMAIL", Key: "a@b.com"})
	_, _ = svc.SaveUnitPix(context.Background(), org, unit, uuid.New(), settings.UnitPixInput{KeyType: "PHONE", Key: "92999990000", Confirmed: true})
	p, err := svc.GetPix(context.Background(), org)
	require.NoError(t, err)
	assert.True(t, p.Default.Configured)
	require.Len(t, p.Units, 1)
	assert.Equal(t, unit, p.Units[0].UnitID)
	assert.Equal(t, "+5592999990000", p.Units[0].Key)
}

func TestPix_ResolveUnidadeDepoisOrganizacao(t *testing.T) {
	svc, _, unit := pixSvc()
	ctx := context.Background()

	got, err := svc.ResolvePixAccount(ctx, org, unit)
	require.NoError(t, err)
	assert.Nil(t, got, "nada configurado")

	_, _ = svc.SavePix(ctx, org, uuid.New(), settings.PixInput{KeyType: "EMAIL", Key: "org@email.com", ReceiverName: "Luan Matos", City: "Manaus"})
	got, _ = svc.ResolvePixAccount(ctx, org, unit)
	require.NotNil(t, got)
	assert.Equal(t, settings.PixAccount{KeyType: "EMAIL", Key: "org@email.com", ReceiverName: "Luan Matos", City: "Manaus"}, *got)

	_, _ = svc.SaveUnitPix(ctx, org, unit, uuid.New(), settings.UnitPixInput{KeyType: "CNPJ", Key: "11222333000181", ReceiverName: "Centro Ltda", Confirmed: true})
	got, _ = svc.ResolvePixAccount(ctx, org, unit)
	require.NotNil(t, got)
	assert.Equal(t, "11222333000181", got.Key)
	assert.Equal(t, "Centro Ltda", got.ReceiverName)
	assert.Empty(t, got.City, "a conta da unidade não tem cidade: vale a do imóvel")

	// outra unidade da organização continua na chave padrão
	other := uuid.New()
	got, _ = svc.ResolvePixAccount(ctx, org, other)
	require.NotNil(t, got)
	assert.Equal(t, "org@email.com", got.Key)
}

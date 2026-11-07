package property_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/validator"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func strp(s string) *string   { return &s }
func intp(i int) *int         { return &i }
func f64p(f float64) *float64 { return &f }

func TestCreatePropertyInput_Validate_CEP(t *testing.T) {
	base := property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Edifício"}

	ok := base
	ok.PostalCode = strp("01310100")
	ok.Neighborhood = strp("Bela Vista")
	assert.NoError(t, validator.Validate(ok))

	semCEP := base
	assert.NoError(t, validator.Validate(semCEP))

	for _, cep := range []string{"0131010", "013101000", "01310-100", "abcdefgh"} {
		in := base
		in.PostalCode = strp(cep)
		assert.Error(t, validator.Validate(in), "cep %q deveria ser inválido", cep)
	}
}

func TestCreateUnitInput_Validate_Medidas(t *testing.T) {
	base := property.CreateUnitInput{Label: "Apto 101"}

	ok := base
	ok.AreaM2 = f64p(54.5)
	ok.Bedrooms = intp(2)
	ok.Bathrooms = intp(0)
	assert.NoError(t, validator.Validate(ok))

	area := base
	area.AreaM2 = f64p(-1)
	assert.Error(t, validator.Validate(area))

	zero := base
	zero.AreaM2 = f64p(0)
	assert.Error(t, validator.Validate(zero))

	q := base
	q.Bedrooms = intp(-1)
	assert.Error(t, validator.Validate(q))

	b := base
	b.Bathrooms = intp(-2)
	assert.Error(t, validator.Validate(b))
}

func TestService_CreateUnit_RótuloDuplicado(t *testing.T) {
	ctx := context.Background()
	svc := property.NewService(newMockRepo())
	org := uuid.New()
	p, err := svc.CreateProperty(ctx, org, org, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Prédio"})
	require.NoError(t, err)

	_, err = svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "Apto 101"})
	require.NoError(t, err)

	_, err = svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "  apto 101 "})
	require.Error(t, err)
	assert.True(t, errors.Is(err, property.ErrDuplicateUnitLabel))
	assert.True(t, errors.Is(err, apierr.ErrConflict))
}

func TestService_CreateUnit_RótuloEmOutroImóvel(t *testing.T) {
	ctx := context.Background()
	svc := property.NewService(newMockRepo())
	org := uuid.New()
	p1, _ := svc.CreateProperty(ctx, org, org, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "A"})
	p2, _ := svc.CreateProperty(ctx, org, org, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "B"})

	_, err := svc.CreateUnit(ctx, p1.ID, org, property.CreateUnitInput{Label: "101"})
	require.NoError(t, err)
	_, err = svc.CreateUnit(ctx, p2.ID, org, property.CreateUnitInput{Label: "101"})
	assert.NoError(t, err)
}

func TestService_CreateUnit_RótuloDeUnidadeInativa(t *testing.T) {
	ctx := context.Background()
	svc := property.NewService(newMockRepo())
	org := uuid.New()
	p, _ := svc.CreateProperty(ctx, org, org, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "A"})

	u, err := svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "101"})
	require.NoError(t, err)
	require.NoError(t, svc.DeleteUnit(ctx, u.ID, org))

	_, err = svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "101"})
	assert.NoError(t, err)
}

func TestService_UpdateUnit_RótuloDuplicado(t *testing.T) {
	ctx := context.Background()
	svc := property.NewService(newMockRepo())
	org := uuid.New()
	p, _ := svc.CreateProperty(ctx, org, org, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "A"})
	_, err := svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "101"})
	require.NoError(t, err)
	u2, err := svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "102"})
	require.NoError(t, err)

	_, err = svc.UpdateUnit(ctx, u2.ID, org, property.CreateUnitInput{Label: "101"})
	assert.True(t, errors.Is(err, property.ErrDuplicateUnitLabel))
}

func TestService_UpdateUnit_MesmoRótuloDaPrópriaUnidade(t *testing.T) {
	ctx := context.Background()
	svc := property.NewService(newMockRepo())
	org := uuid.New()
	p, _ := svc.CreateProperty(ctx, org, org, property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "A"})
	u, err := svc.CreateUnit(ctx, p.ID, org, property.CreateUnitInput{Label: "101"})
	require.NoError(t, err)

	area := 40.0
	_, err = svc.UpdateUnit(ctx, u.ID, org, property.CreateUnitInput{Label: "101", AreaM2: &area})
	assert.NoError(t, err)
}

func TestCreatePropertyInput_Validate_TipoComercial(t *testing.T) {
	for _, typ := range []string{"RESIDENTIAL", "COMMERCIAL", "SINGLE"} {
		assert.NoError(t, validator.Validate(property.CreatePropertyInput{Type: typ, Name: "X"}), "tipo %s deveria ser válido", typ)
	}
	assert.Error(t, validator.Validate(property.CreatePropertyInput{Type: "TERRENO", Name: "X"}))
}

func TestCreatePropertyInput_Validate_NumeroEComplemento(t *testing.T) {
	base := property.CreatePropertyInput{Type: "RESIDENTIAL", Name: "Edifício"}

	ok := base
	ok.Number = strp("120")
	ok.Complement = strp("Bloco B")
	assert.NoError(t, validator.Validate(ok))

	long := base
	long.Number = strp(strings.Repeat("1", 21))
	assert.Error(t, validator.Validate(long), "number com mais de 20 caracteres")

	long = base
	long.Complement = strp(strings.Repeat("a", 101))
	assert.Error(t, validator.Validate(long), "complement com mais de 100 caracteres")

	limite := base
	limite.Number = strp(strings.Repeat("1", 20))
	limite.Complement = strp(strings.Repeat("a", 100))
	assert.NoError(t, validator.Validate(limite))
}

func TestCreateUnitInput_Validate_AluguelDeReferencia(t *testing.T) {
	base := property.CreateUnitInput{Label: "Apto 101"}

	assert.NoError(t, validator.Validate(base), "sem aluguel de referência é válido")

	ok := base
	ok.ReferenceRent = f64p(1850)
	assert.NoError(t, validator.Validate(ok))

	zero := base
	zero.ReferenceRent = f64p(0)
	assert.NoError(t, validator.Validate(zero), "zero é aceito (gte=0)")

	neg := base
	neg.ReferenceRent = f64p(-1)
	assert.Error(t, validator.Validate(neg))
}

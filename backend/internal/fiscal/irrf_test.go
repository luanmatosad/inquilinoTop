package fiscal_test

import (
	"context"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockBracketsRepo struct {
	brackets []fiscal.IRRFBracket
}

func (m *mockBracketsRepo) ActiveBrackets(_ context.Context, at time.Time) ([]fiscal.IRRFBracket, error) {
	var out []fiscal.IRRFBracket
	for _, b := range m.brackets {
		if !b.ValidFrom.After(at) {
			out = append(out, b)
		}
	}
	return out, nil
}

func seed2024() *mockBracketsRepo {
	vf, _ := time.Parse("2006-01-02", "2024-02-01")
	max1 := 2826.65
	max2 := 3751.05
	max3 := 4664.68
	return &mockBracketsRepo{
		brackets: []fiscal.IRRFBracket{
			{ValidFrom: vf, MinBase: 0,       MaxBase: func() *float64 { x := 2259.20; return &x }(), Rate: 0,       Deduction: 0},
			{ValidFrom: vf, MinBase: 2259.21, MaxBase: &max1, Rate: 0.075, Deduction: 169.44},
			{ValidFrom: vf, MinBase: 2826.66, MaxBase: &max2, Rate: 0.15,  Deduction: 381.44},
			{ValidFrom: vf, MinBase: 3751.06, MaxBase: &max3, Rate: 0.225, Deduction: 662.77},
			{ValidFrom: vf, MinBase: 4664.69, MaxBase: nil,   Rate: 0.275, Deduction: 896.00},
		},
	}
}

func TestIRRFTable_Isento(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	v, err := tab.Calculate(context.Background(), 2000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 0, v, 0.01)
}

func TestIRRFTable_FaixaIntermediaria(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	v, err := tab.Calculate(context.Background(), 3000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 68.56, v, 0.01)
}

func TestIRRFTable_FaixaTopo(t *testing.T) {
	tab := fiscal.NewIRRFTable(seed2024())
	v, err := tab.Calculate(context.Background(), 10000, time.Now())
	require.NoError(t, err)
	assert.InDelta(t, 1854, v, 0.01)
}

func TestIRRFTable_SemFaixaValida(t *testing.T) {
	tab := fiscal.NewIRRFTable(&mockBracketsRepo{})
	_, err := tab.Calculate(context.Background(), 3000, time.Now())
	require.Error(t, err)
}

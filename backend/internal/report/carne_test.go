package report_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/report"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func october() *mockRepo {
	u1, u2 := uuid.New(), uuid.New()
	return &mockRepo{
		income: []report.IncomeLine{
			{Payer: "Carla Dias", UnitID: u2, PaidDate: "2026-10-02", Amount: 2200},
			{Payer: "Marina Souza", UnitID: u1, PaidDate: "2026-10-05", Amount: 1850},
			{Payer: "Rafael Tavares", UnitID: u1, PaidDate: "2026-10-05", Amount: 1600},
			{Payer: "Bruno Lima", UnitID: u1, PaidDate: "2026-10-08", Amount: 1550},
			{Payer: "Paulo Nogueira", UnitID: u2, PaidDate: "2026-10-10", Amount: 1100},
		},
		deducts: []report.DeductionLine{
			{Description: "Condomínio de outubro", UnitID: u2, Category: "CONDO", Amount: 680},
			{Description: "IPTU · parcela 10", UnitID: u1, Category: "TAX", Amount: 420},
		},
	}
}

func TestService_CarneLeao_Outubro(t *testing.T) {
	repo := october()
	c, err := svcAt(repo, 2026, time.November, 8).CarneLeao(context.Background(), org, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, "2026-10", c.Month)
	assert.Equal(t, 8300.0, c.Income.Total)
	assert.Equal(t, 5, c.Income.Count)
	assert.Equal(t, 1100.0, c.Deductions.Total)
	assert.Equal(t, 2, c.Deductions.Count)
	assert.Equal(t, 7200.0, c.Base)
	assert.Equal(t, "2026-11-30", c.DueDate)
	assert.Equal(t, "2026-10-01", repo.from.Format("2006-01-02"))
	assert.Equal(t, "2026-10-31", repo.to.Format("2006-01-02"))
	assert.ElementsMatch(t, []string{"TAX", "CONDO"}, repo.cats, "só as categorias que entram")
}

func TestService_CarneLeao_BaseNuncaNegativa(t *testing.T) {
	repo := &mockRepo{
		income:  []report.IncomeLine{{Payer: "A", Amount: 500}},
		deducts: []report.DeductionLine{{Description: "d", Category: "TAX", Amount: 900}},
	}
	c, err := svcAt(repo, 2026, time.November, 8).CarneLeao(context.Background(), org, "2026-10")
	require.NoError(t, err)
	assert.Equal(t, 0.0, c.Base)
	assert.Equal(t, 900.0, c.Deductions.Total, "o total bruto continua visível")
}

func TestService_CarneLeao_ListasNuncaNil(t *testing.T) {
	c, err := svcAt(&mockRepo{}, 2026, time.November, 8).CarneLeao(context.Background(), org, "2026-10")
	require.NoError(t, err)
	assert.NotNil(t, c.Income.Lines)
	assert.NotNil(t, c.Deductions.Lines)
	assert.Equal(t, 0.0, c.Base)
}

func TestService_CarneLeao_MesInvalidoEMesCorrente(t *testing.T) {
	s := svcAt(&mockRepo{}, 2026, time.November, 8)
	for _, m := range []string{"", "2026-13", "26-10", "1999-12"} {
		_, err := s.CarneLeao(context.Background(), org, m)
		assert.ErrorIs(t, err, report.ErrInvalidMonth, m)
	}
	for _, m := range []string{"2026-11", "2026-12", "2027-01"} {
		_, err := s.CarneLeao(context.Background(), org, m)
		assert.ErrorIs(t, err, report.ErrMonthNotEnded, m)
	}
}

func TestService_CarneLeao_Prazo(t *testing.T) {
	cases := map[string]string{
		"2026-10": "2026-11-30", // segunda
		"2026-04": "2026-05-29", // 31/05 é domingo
		"2025-12": "2026-01-30", // 31/01 é sábado; virada de ano
		"2026-09": "2026-10-30", // 31/10 é sábado
	}
	s := svcAt(&mockRepo{}, 2026, time.November, 8)
	for month, want := range cases {
		c, err := s.CarneLeao(context.Background(), org, month)
		require.NoError(t, err, month)
		assert.Equal(t, want, c.DueDate, month)
	}
}

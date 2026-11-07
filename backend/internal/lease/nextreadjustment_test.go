package lease_test

import (
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/lease"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func d(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, time.UTC) }
func dptr(y int, m time.Month, day int) *time.Time {
	t := d(y, m, day)
	return &t
}
func ip(i int) *int { return &i }

func TestNextReadjustment(t *testing.T) {
	cases := []struct {
		name  string
		month *int
		start time.Time
		last  *time.Time
		want  *time.Time
	}{
		{"depois do início, mesmo mês", ip(3), d(2025, 3, 10), nil, dptr(2026, 3, 1)},
		{"depois de um reajuste aplicado", ip(3), d(2025, 3, 10), dptr(2026, 3, 5), dptr(2027, 3, 1)},
		{"mês de reajuste diferente do início", ip(11), d(2024, 8, 1), nil, dptr(2025, 11, 1)},
		{"mês de reajuste antes do início no ano", ip(1), d(2025, 12, 1), nil, dptr(2027, 1, 1)},
		{"início em dezembro, reajuste em dezembro", ip(12), d(2025, 12, 20), nil, dptr(2026, 12, 1)},
		{"virada de ano com último reajuste em dezembro", ip(12), d(2024, 12, 1), dptr(2025, 12, 1), dptr(2026, 12, 1)},
		{"último reajuste atrasado (abril em vez de março)", ip(3), d(2025, 3, 10), dptr(2026, 4, 2), dptr(2027, 3, 1)},
		{"reajuste aplicado adiantado (fevereiro para o ciclo de março)", ip(3), d(2025, 3, 10), dptr(2026, 2, 20), dptr(2027, 3, 1)},
		{"reajuste aplicado seis meses depois: ainda é o ciclo daquele ano", ip(3), d(2025, 3, 10), dptr(2026, 9, 1), dptr(2027, 3, 1)},
		{"reajuste aplicado sete meses depois conta para o ciclo seguinte", ip(3), d(2025, 3, 10), dptr(2026, 10, 1), dptr(2028, 3, 1)},
		{"mês de reajuste um mês depois do início", ip(4), d(2025, 3, 10), nil, dptr(2026, 4, 1)},
		{"mês de reajuste um mês antes do início só vale depois de 12 meses", ip(2), d(2025, 3, 10), nil, dptr(2027, 2, 1)},
		{"sem mês de reajuste", nil, d(2025, 3, 10), nil, nil},
		{"último reajuste anterior ao início é ignorado", ip(3), d(2025, 3, 10), dptr(2024, 1, 1), dptr(2026, 3, 1)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := lease.NextReadjustment(c.month, c.start, c.last)
			if c.want == nil {
				assert.Nil(t, got)
				return
			}
			require.NotNil(t, got)
			assert.True(t, c.want.Equal(*got), "esperado %s, veio %s", c.want.Format("2006-01-02"), got.Format("2006-01-02"))
		})
	}
}

func TestNextReadjustment_SempreDia1(t *testing.T) {
	got := lease.NextReadjustment(ip(7), d(2025, 7, 31), nil)
	require.NotNil(t, got)
	assert.Equal(t, 1, got.Day())
}

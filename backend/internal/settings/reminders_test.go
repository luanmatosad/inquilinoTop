package settings_test

import (
	"strings"
	"testing"

	"github.com/inquilinotop/api/internal/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func rem(name string, days int, body string) settings.Reminder {
	return settings.Reminder{Name: name, OffsetDays: days, Body: body}
}

func TestDefaultReminders_SaoOsQuatroDoCanvasEValidos(t *testing.T) {
	d := settings.DefaultReminders()
	require.Len(t, d, 4)
	var days []int
	var names []string
	for _, r := range d {
		days = append(days, r.OffsetDays)
		names = append(names, r.Name)
	}
	assert.Equal(t, []int{-3, 0, 3, 10}, days)
	assert.Equal(t, []string{"Lembrete gentil", "Cobrança com Pix", "Aviso de atraso", "Segundo aviso, tom mais firme"}, names)
	_, err := settings.ValidateReminders(d)
	assert.NoError(t, err, "os padrões passam pela própria validação")
	for _, r := range d {
		assert.Contains(t, r.Body, "{nome}")
		assert.Contains(t, r.Body, "{link}")
	}
}

func TestValidateReminders_OrdenaEApara(t *testing.T) {
	got, err := settings.ValidateReminders([]settings.Reminder{
		rem(" Depois ", 3, " Oi, {nome}! "),
		rem("Antes", -3, "Oi {nome}"),
	})
	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, -3, got[0].OffsetDays, "ordenado por dias")
	assert.Equal(t, "Depois", got[1].Name)
	assert.Equal(t, "Oi, {nome}!", got[1].Body, "texto aparado")
}

func TestValidateReminders_TodasAsVariaveisValem(t *testing.T) {
	body := "{nome} {valor} {vencimento} {imóvel} {mês} {pix} {link}"
	_, err := settings.ValidateReminders([]settings.Reminder{rem("Todas", 0, body)})
	assert.NoError(t, err)
}

func TestValidateReminders_Invalidos(t *testing.T) {
	long := strings.Repeat("a", 1001)
	cases := map[string]struct {
		in   []settings.Reminder
		want string
	}{
		"lista vazia":        {nil, "de 1 a 8"},
		"nove lembretes":     {nine(), "de 1 a 8"},
		"nome vazio":         {[]settings.Reminder{rem("  ", 0, "x")}, "nome"},
		"nome longo":         {[]settings.Reminder{rem(strings.Repeat("n", 41), 0, "x")}, "nome"},
		"dias abaixo":        {[]settings.Reminder{rem("A", -31, "x")}, "-30 a 60"},
		"dias acima":         {[]settings.Reminder{rem("A", 61, "x")}, "-30 a 60"},
		"dias repetidos":     {[]settings.Reminder{rem("A", 0, "x"), rem("B", 0, "y")}, "mesmos dias"},
		"texto vazio":        {[]settings.Reminder{rem("A", 0, "   ")}, "texto"},
		"texto longo":        {[]settings.Reminder{rem("A", 0, long)}, "texto"},
		"variável errada":    {[]settings.Reminder{rem("A", 0, "Oi {nom}!")}, "{nom}"},
		"variável vazia":     {[]settings.Reminder{rem("A", 0, "Oi {}!")}, "{}"},
		"variável maiúscula": {[]settings.Reminder{rem("A", 0, "Oi {Nome}!")}, "{Nome}"},
	}
	for name, c := range cases {
		_, err := settings.ValidateReminders(c.in)
		require.ErrorIs(t, err, settings.ErrInvalidReminders, name)
		assert.Contains(t, err.Error(), c.want, name)
	}
}

func TestValidateReminders_ChaveSoltaNaoEVariavel(t *testing.T) {
	_, err := settings.ValidateReminders([]settings.Reminder{rem("A", 0, "Valor {valor e mais {pix")})
	assert.NoError(t, err, "chave sem fechar é texto comum")
}

func TestValidateReminders_ContaLetrasNaoBytes(t *testing.T) {
	_, err := settings.ValidateReminders([]settings.Reminder{rem(strings.Repeat("ç", 40), 0, strings.Repeat("ã", 1000))})
	assert.NoError(t, err)
}

func nine() []settings.Reminder {
	var out []settings.Reminder
	for i := 0; i < 9; i++ {
		out = append(out, rem("L", i, "x"))
	}
	return out
}

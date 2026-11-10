package settings_test

import (
	"strings"
	"testing"

	"github.com/inquilinotop/api/internal/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizePixKey_Validas(t *testing.T) {
	cases := []struct{ typ, in, want string }{
		{"CPF", "529.982.247-25", "52998224725"},
		{"CPF", " 52998224725 ", "52998224725"},
		{"CNPJ", "11.222.333/0001-81", "11222333000181"},
		{"EMAIL", "  Socio@Email.COM ", "socio@email.com"},
		{"PHONE", "(92) 99999-0000", "+5592999990000"},
		{"PHONE", "92 3333-0000", "+559233330000"},
		{"PHONE", "+55 92 99999-0000", "+5592999990000"},
		{"PHONE", "5592999990000", "+5592999990000"},
		{"RANDOM", "123E4567-E89B-12D3-A456-426614174000", "123e4567-e89b-12d3-a456-426614174000"},
	}
	for _, c := range cases {
		got, err := settings.NormalizePixKey(c.typ, c.in)
		require.NoError(t, err, c.typ+" "+c.in)
		assert.Equal(t, c.want, got, c.typ+" "+c.in)
	}
}

func TestNormalizePixKey_Invalidas(t *testing.T) {
	cases := []struct{ typ, in string }{
		{"CPF", "529.982.247-26"},      // dígito verificador
		{"CPF", "111.111.111-11"},      // repetido
		{"CPF", "1234"},                // curto
		{"CPF", ""},                    // vazio
		{"CNPJ", "11.222.333/0001-82"}, // dígito verificador
		{"CNPJ", "52998224725"},        // é CPF
		{"EMAIL", "sem-arroba"},
		{"EMAIL", "a@b"},
		{"EMAIL", strings.Repeat("a", 70) + "@email.com"}, // > 77
		{"PHONE", "123"},
		{"PHONE", "(92) 9999-00"},
		{"PHONE", "+1 202 555 0100"},
		{"RANDOM", "nao-e-uuid"},
		{"RANDOM", "123e4567-e89b-12d3-a456-42661417400"},
		{"OUTRO", "x"}, // tipo desconhecido
		{"", "52998224725"},
	}
	for _, c := range cases {
		_, err := settings.NormalizePixKey(c.typ, c.in)
		assert.ErrorIs(t, err, settings.ErrInvalidPixKey, c.typ+" "+c.in)
	}
}

func TestValidateReceiver(t *testing.T) {
	assert.NoError(t, settings.ValidateReceiver("", ""), "vazios usam as reservas")
	assert.NoError(t, settings.ValidateReceiver(strings.Repeat("a", 25), strings.Repeat("b", 15)))
	assert.ErrorIs(t, settings.ValidateReceiver(strings.Repeat("a", 26), ""), settings.ErrInvalidPix)
	assert.ErrorIs(t, settings.ValidateReceiver("", strings.Repeat("b", 16)), settings.ErrInvalidPix)
	// conta letras (runas), não bytes: "Ç" ocupa 2 bytes
	assert.NoError(t, settings.ValidateReceiver(strings.Repeat("ç", 25), strings.Repeat("ã", 15)))
}

package brdoc

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOnlyDigits(t *testing.T) {
	assert.Equal(t, "52998224725", OnlyDigits("529.982.247-25"))
	assert.Equal(t, "11222333000181", OnlyDigits("11.222.333/0001-81"))
	assert.Equal(t, "", OnlyDigits("abc"))
}

func TestValidCPF(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"válido com máscara", "529.982.247-25", true},
		{"válido sem máscara", "52998224725", true},
		{"dígito verificador errado", "52998224726", false},
		{"repetidos", "111.111.111-11", false},
		{"zeros", "00000000000", false},
		{"curto", "1234567890", false},
		{"longo", "529982247250", false},
		{"vazio", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ValidCPF(tt.in))
		})
	}
}

func TestValidCNPJ(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"válido com máscara", "11.222.333/0001-81", true},
		{"válido sem máscara", "11222333000181", true},
		{"dígito verificador errado", "11222333000182", false},
		{"repetidos", "11.111.111/1111-11", false},
		{"curto", "1122233300018", false},
		{"cpf no lugar", "52998224725", false},
		{"vazio", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, ValidCNPJ(tt.in))
		})
	}
}

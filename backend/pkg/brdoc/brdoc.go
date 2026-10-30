// Package brdoc valida documentos brasileiros (CPF e CNPJ).
package brdoc

import "strings"

// OnlyDigits remove tudo que não for dígito.
func OnlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func allEqual(s string) bool {
	for i := 1; i < len(s); i++ {
		if s[i] != s[0] {
			return false
		}
	}
	return true
}

// checkDigit calcula o dígito verificador sobre digits usando os pesos informados.
func checkDigit(digits string, weights []int) int {
	sum := 0
	for i, w := range weights {
		sum += int(digits[i]-'0') * w
	}
	rest := sum % 11
	if rest < 2 {
		return 0
	}
	return 11 - rest
}

// ValidCPF informa se s (com ou sem máscara) é um CPF válido.
func ValidCPF(s string) bool {
	d := OnlyDigits(s)
	if len(d) != 11 || allEqual(d) {
		return false
	}
	w1 := []int{10, 9, 8, 7, 6, 5, 4, 3, 2}
	w2 := []int{11, 10, 9, 8, 7, 6, 5, 4, 3, 2}
	return checkDigit(d, w1) == int(d[9]-'0') && checkDigit(d, w2) == int(d[10]-'0')
}

// ValidCNPJ informa se s (com ou sem máscara) é um CNPJ válido.
func ValidCNPJ(s string) bool {
	d := OnlyDigits(s)
	if len(d) != 14 || allEqual(d) {
		return false
	}
	w1 := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	w2 := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	return checkDigit(d, w1) == int(d[12]-'0') && checkDigit(d, w2) == int(d[13]-'0')
}

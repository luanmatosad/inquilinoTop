package settings

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/inquilinotop/api/pkg/brdoc"
)

var (
	// ErrInvalidPixKey: a chave não é válida para o tipo informado (HTTP 400).
	ErrInvalidPixKey = errors.New("settings: chave Pix inválida")
	// ErrInvalidPix: nome do recebedor (até 25) ou cidade (até 15) acima do limite do BR Code (HTTP 400).
	ErrInvalidPix = errors.New("settings: dados do Pix inválidos")
	// ErrConfirmationRequired: faltou a confirmação de quem autorizou receber em outra conta (HTTP 400).
	ErrConfirmationRequired = errors.New("settings: confirmação obrigatória")
)

// Tipos de chave Pix.
const (
	PixKeyCPF    = "CPF"
	PixKeyCNPJ   = "CNPJ"
	PixKeyEmail  = "EMAIL"
	PixKeyPhone  = "PHONE"
	PixKeyRandom = "RANDOM"
)

// Limites do BR Code (campos 59 e 60).
const (
	MaxReceiverNameRunes = 25
	MaxPixCityRunes      = 15
	maxPixKeyLen         = 77
)

var (
	emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	uuidRe  = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

// NormalizePixKey confere a chave para o tipo e devolve a forma gravada: CPF e CNPJ só com dígitos (e dígito
// verificador certo), e-mail em minúsculas, telefone como +55 mais dígitos e chave aleatória (UUID) em minúsculas.
func NormalizePixKey(keyType, raw string) (string, error) {
	key := strings.TrimSpace(raw)
	switch keyType {
	case PixKeyCPF:
		d := brdoc.OnlyDigits(key)
		if !brdoc.ValidCPF(d) {
			return "", ErrInvalidPixKey
		}
		return d, nil
	case PixKeyCNPJ:
		d := brdoc.OnlyDigits(key)
		if !brdoc.ValidCNPJ(d) {
			return "", ErrInvalidPixKey
		}
		return d, nil
	case PixKeyEmail:
		e := strings.ToLower(key)
		if len(e) > maxPixKeyLen || !emailRe.MatchString(e) {
			return "", ErrInvalidPixKey
		}
		return e, nil
	case PixKeyPhone:
		d := brdoc.OnlyDigits(key)
		if strings.HasPrefix(key, "+") && !strings.HasPrefix(d, "55") {
			return "", ErrInvalidPixKey // só números do Brasil
		}
		switch {
		case len(d) == 10 || len(d) == 11:
			return "+55" + d, nil
		case (len(d) == 12 || len(d) == 13) && strings.HasPrefix(d, "55"):
			return "+" + d, nil
		}
		return "", ErrInvalidPixKey
	case PixKeyRandom:
		u := strings.ToLower(key)
		if !uuidRe.MatchString(u) {
			return "", ErrInvalidPixKey
		}
		return u, nil
	}
	return "", ErrInvalidPixKey
}

// ValidateReceiver recusa nome e cidade acima do limite do BR Code (em vez de cortar sem avisar). Vazio vale:
// a cobrança usa o nome do perfil e a cidade do imóvel.
func ValidateReceiver(name, city string) error {
	if utf8.RuneCountInString(strings.TrimSpace(name)) > MaxReceiverNameRunes || utf8.RuneCountInString(strings.TrimSpace(city)) > MaxPixCityRunes {
		return ErrInvalidPix
	}
	return nil
}

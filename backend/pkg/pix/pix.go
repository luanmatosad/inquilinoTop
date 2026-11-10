// Package pix gera o Pix copia-e-cola estático (BR Code, EMV) a partir de uma chave: o dinheiro vai direto
// para o dono, sem provedor de pagamento no meio.
package pix

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// ErrInvalid: parâmetros que não formam um BR Code válido.
var ErrInvalid = errors.New("pix: parâmetros inválidos")

// Params descreve o recebedor e a cobrança.
type Params struct {
	Key    string  // chave Pix (CPF/CNPJ, e-mail, telefone ou aleatória)
	Name   string  // nome do recebedor (até 25 caracteres)
	City   string  // cidade do recebedor (até 15 caracteres)
	Amount float64 // 0 = valor aberto (campo 54 omitido)
	TxID   string  // identificador da transação (1 a 25 caracteres alfanuméricos; "***" = sem txid)
}

func field(id, value string) string { return fmt.Sprintf("%s%02d%s", id, len(value), value) }

var accents = strings.NewReplacer(
	"á", "a", "à", "a", "â", "a", "ã", "a", "ä", "a", "é", "e", "è", "e", "ê", "e", "ë", "e",
	"í", "i", "ì", "i", "î", "i", "ï", "i", "ó", "o", "ò", "o", "ô", "o", "õ", "o", "ö", "o",
	"ú", "u", "ù", "u", "û", "u", "ü", "u", "ç", "c", "ñ", "n",
	"Á", "A", "À", "A", "Â", "A", "Ã", "A", "Ä", "A", "É", "E", "È", "E", "Ê", "E", "Ë", "E",
	"Í", "I", "Ì", "I", "Î", "I", "Ï", "I", "Ó", "O", "Ò", "O", "Ô", "O", "Õ", "O", "Ö", "O",
	"Ú", "U", "Ù", "U", "Û", "U", "Ü", "U", "Ç", "C", "Ñ", "N",
)

// clean tira acentos, passa para maiúsculas e corta em max caracteres.
func clean(s string, max int) string {
	r := []rune(strings.ToUpper(strings.TrimSpace(accents.Replace(s))))
	if len(r) > max {
		r = r[:max]
	}
	return strings.TrimSpace(string(r))
}

// ReceiverName devolve o nome do recebedor como entra no código (sem acento, maiúsculas, até 25 caracteres), com a
// reserva "RECEBEDOR" se vier vazio. Serve para mostrar ao pagador exatamente para quem ele está pagando.
func ReceiverName(name string) string {
	if n := clean(name, 25); n != "" {
		return n
	}
	return "RECEBEDOR"
}

// CRC16 calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF) em hexadecimal maiúsculo de 4 dígitos.
func CRC16(s string) string {
	crc := uint16(0xFFFF)
	for _, b := range []byte(s) {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = crc<<1 ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return fmt.Sprintf("%04X", crc)
}

var punctuatedDocument = regexp.MustCompile(`^[\d.\-/\s]+$`)

// normalizeKey tira a pontuação de CPF/CNPJ (o DICT só guarda os dígitos). E-mail, telefone com "+55" e chave
// aleatória seguem como cadastrados.
func normalizeKey(k string) string {
	k = strings.TrimSpace(k)
	if punctuatedDocument.MatchString(k) {
		var b strings.Builder
		for _, r := range k {
			if r >= '0' && r <= '9' {
				b.WriteRune(r)
			}
		}
		return b.String()
	}
	return k
}

// Build monta o código copia-e-cola.
func Build(p Params) (string, error) {
	key := normalizeKey(p.Key)
	if key == "" || len(key) > 77 || p.Amount < 0 {
		return "", ErrInvalid
	}
	name := ReceiverName(p.Name)
	city := clean(p.City, 15)
	if city == "" {
		city = "BRASIL"
	}
	txid := strings.TrimSpace(p.TxID)
	if txid == "" || len(txid) > 25 {
		txid = "***"
	}

	var b strings.Builder
	b.WriteString(field("00", "01"))
	b.WriteString(field("26", field("00", "br.gov.bcb.pix")+field("01", key)))
	b.WriteString(field("52", "0000"))
	b.WriteString(field("53", "986"))
	if p.Amount > 0 {
		b.WriteString(field("54", fmt.Sprintf("%.2f", p.Amount)))
	}
	b.WriteString(field("58", "BR"))
	b.WriteString(field("59", name))
	b.WriteString(field("60", city))
	b.WriteString(field("62", field("05", txid)))
	b.WriteString("6304")
	return b.String() + CRC16(b.String()), nil
}

// TxIDFromID deriva um txid alfanumérico de até 25 caracteres a partir de um UUID.
func TxIDFromID(id string) string {
	clean := strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(id), "-", ""))
	if clean == "" {
		return "***"
	}
	if len(clean) > 25 {
		clean = clean[:25]
	}
	return clean
}

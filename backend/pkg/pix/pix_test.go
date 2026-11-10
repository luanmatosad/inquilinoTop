package pix_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/inquilinotop/api/pkg/pix"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCRC16_VetorDeReferência(t *testing.T) {
	assert.Equal(t, "29B1", pix.CRC16("123456789"))
}

func TestBuild_EstruturaECRC(t *testing.T) {
	code, err := pix.Build(pix.Params{
		Key: "123e4567-e89b-12d3-a456-426614174000", Name: "Fulano de Tal", City: "Brasília", Amount: 1850, TxID: "ABC123",
	})
	require.NoError(t, err)

	assert.True(t, strings.HasPrefix(code, "000201"), "formato do payload")
	assert.Contains(t, code, "0014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000")
	assert.Contains(t, code, "5303986", "moeda BRL")
	assert.Contains(t, code, "54071850.00", "valor com duas casas")
	assert.Contains(t, code, "5802BR")
	assert.Contains(t, code, "5913FULANO DE TAL")
	assert.Contains(t, code, "6008BRASILIA")
	assert.Contains(t, code, "0506ABC123")

	body, crc := code[:len(code)-4], code[len(code)-4:]
	assert.True(t, strings.HasSuffix(body, "6304"))
	assert.Equal(t, pix.CRC16(body), crc)
}

func TestBuild_SemValorOmiteOCampo54(t *testing.T) {
	code, err := pix.Build(pix.Params{Key: "11999998888", Name: "Ana", City: "SP", TxID: "***"})
	require.NoError(t, err)
	assert.Contains(t, code, "53039865802BR", "sem campo 54 entre a moeda e o país")
}

func TestBuild_TruncaNomeECidade(t *testing.T) {
	code, err := pix.Build(pix.Params{
		Key: "a@b.com", Name: "João da Conceição Aparecida Fernandes Neto", City: "São José dos Campos do Sul", Amount: 10, TxID: "X1",
	})
	require.NoError(t, err)
	assert.Contains(t, code, "5925JOAO DA CONCEICAO APARECI")
	assert.Contains(t, code, "6015SAO JOSE DOS CA")
}

func TestBuild_ValoresInválidos(t *testing.T) {
	_, err := pix.Build(pix.Params{Key: "", Name: "A", City: "B", Amount: 1, TxID: "X"})
	assert.ErrorIs(t, err, pix.ErrInvalid)
	_, err = pix.Build(pix.Params{Key: "k", Name: "A", City: "B", Amount: -1, TxID: "X"})
	assert.ErrorIs(t, err, pix.ErrInvalid)
	_, err = pix.Build(pix.Params{Key: strings.Repeat("a", 78), Name: "A", City: "B", Amount: 1, TxID: "X"})
	assert.ErrorIs(t, err, pix.ErrInvalid)
}

func TestBuild_NomeECidadeVazios(t *testing.T) {
	code, err := pix.Build(pix.Params{Key: "k@x.com", Amount: 5, TxID: "T"})
	require.NoError(t, err)
	assert.Contains(t, code, "5909RECEBEDOR")
	assert.Contains(t, code, "6006BRASIL")
}

func TestTxIDFromID(t *testing.T) {
	assert.Equal(t, "62AFF4AC892348CD9798B471E", pix.TxIDFromID("62aff4ac-8923-48cd-9798-b471eeada07d"))
	assert.Equal(t, "***", pix.TxIDFromID(""))
}

func TestBuild_NormalizaChaveComPontuacao(t *testing.T) {
	cases := map[string]string{
		"123.456.789-09":                       "12345678909",
		"12.345.678/0001-95":                   "12345678000195",
		"  a@b.com  ":                          "a@b.com",
		"+5511999998888":                       "+5511999998888",
		"123e4567-e89b-12d3-a456-426614174000": "123e4567-e89b-12d3-a456-426614174000",
	}
	for in, want := range cases {
		code, err := pix.Build(pix.Params{Key: in, Name: "A", City: "B", Amount: 1, TxID: "X"})
		require.NoError(t, err)
		assert.Contains(t, code, "01"+fmt.Sprintf("%02d", len(want))+want, in)
	}
}

func TestReceiverName_ComoEntraNoCodigo(t *testing.T) {
	assert.Equal(t, "LUAN MATOS DE ABREU DIAS", pix.ReceiverName("Luan Matos de Abreu Dias"))
	assert.Equal(t, "JOAO DA CONCEICAO", pix.ReceiverName("  João da Conceição "))
	assert.Equal(t, 25, len(pix.ReceiverName("Nome muito mais longo que vinte e cinco letras")))
	assert.Equal(t, "RECEBEDOR", pix.ReceiverName("   "), "vazio usa a reserva do BR Code")
	// o mesmo valor vai no campo 59 do código
	code, err := pix.Build(pix.Params{Key: "a@b.com", Name: "João da Conceição", City: "Manaus", Amount: 10})
	require.NoError(t, err)
	assert.Contains(t, code, "5917"+pix.ReceiverName("João da Conceição"))
}

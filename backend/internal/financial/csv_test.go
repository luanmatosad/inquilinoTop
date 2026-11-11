package financial

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServiceParseBankCSV_LinhasValidas(t *testing.T) {
	in := "date,description,amount,type\n" +
		"2026-05-10,PIX ALUGUEL,2500.00,CREDIT\n" +
		"10/05/2026,TARIFA BANCARIA,12.50,debit\n"

	rows, err := ParseBankCSV(strings.NewReader(in))
	require.NoError(t, err)
	require.Len(t, rows, 2)

	assert.Equal(t, time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC), rows[0].Date)
	assert.Equal(t, "PIX ALUGUEL", rows[0].Description)
	assert.Equal(t, 2500.0, rows[0].Amount)
	assert.Equal(t, TypeCredit, rows[0].Type)

	assert.Equal(t, 12.5, rows[1].Amount)
	assert.Equal(t, TypeDebit, rows[1].Type, "tipo aceita minúsculo e normaliza")
}

func TestServiceParseBankCSV_CabecalhoErrado(t *testing.T) {
	_, err := ParseBankCSV(strings.NewReader("data,descricao,valor,tipo\n2026-05-10,X,1,CREDIT\n"))
	assert.ErrorIs(t, err, ErrInvalidCSV)
}

func TestServiceParseBankCSV_LinhaInvalidaRejeitaArquivoInteiro(t *testing.T) {
	cases := map[string]string{
		"data inválida":     "2026-02-30,X,1,CREDIT\n",
		"valor negativo":    "2026-05-10,X,-1,CREDIT\n",
		"valor zero":        "2026-05-10,X,0,CREDIT\n",
		"tipo desconhecido": "2026-05-10,X,1,OUTRO\n",
		"descrição vazia":   "2026-05-10,,1,CREDIT\n",
		"número de colunas": "2026-05-10,X,1\n",
	}
	for name, line := range cases {
		t.Run(name, func(t *testing.T) {
			// Linha válida antes da inválida: o arquivo não é aceito parcialmente.
			in := "date,description,amount,type\n2026-05-01,OK,1,CREDIT\n" + line
			_, err := ParseBankCSV(strings.NewReader(in))
			assert.ErrorIs(t, err, ErrInvalidCSV)
		})
	}
}

func TestServiceParseBankCSV_ArquivoVazio(t *testing.T) {
	_, err := ParseBankCSV(strings.NewReader(""))
	assert.ErrorIs(t, err, ErrInvalidCSV)
}

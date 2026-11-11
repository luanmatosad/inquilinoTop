package financial

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"
)

// MaxBankCSVRows limita o tamanho do arquivo aceito (proteção de memória).
const MaxBankCSVRows = 5000

var csvHeader = []string{"date", "description", "amount", "type"}

// ParseBankCSV lê um extrato com cabeçalho exato `date,description,amount,type`.
// Datas: AAAA-MM-DD ou DD/MM/AAAA. Valor: positivo, ponto decimal. Tipo: CREDIT ou DEBIT (case-insensitive).
// Qualquer linha inválida rejeita o arquivo inteiro (ErrInvalidCSV com o número da linha).
func ParseBankCSV(r io.Reader) ([]BankRecordInput, error) {
	cr := csv.NewReader(r)
	cr.TrimLeadingSpace = true
	cr.FieldsPerRecord = len(csvHeader)

	header, err := cr.Read()
	if err != nil {
		return nil, fmt.Errorf("financial.csv: ler cabeçalho: %w (cabeçalho ausente)", ErrInvalidCSV)
	}
	for i, h := range csvHeader {
		if !strings.EqualFold(strings.TrimSpace(header[i]), h) {
			return nil, fmt.Errorf("financial.csv: validar cabeçalho: %w (esperado date,description,amount,type)", ErrInvalidCSV)
		}
	}

	var out []BankRecordInput
	for line := 2; ; line++ {
		rec, err := cr.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("financial.csv: linha %d: %w (%v)", line, ErrInvalidCSV, err)
		}
		if len(out) >= MaxBankCSVRows {
			return nil, fmt.Errorf("financial.csv: limite de linhas: %w (máximo de %d)", ErrInvalidCSV, MaxBankCSVRows)
		}
		in, err := parseBankRow(rec)
		if err != nil {
			return nil, fmt.Errorf("financial.csv: linha %d: %w (%v)", line, ErrInvalidCSV, err)
		}
		out = append(out, in)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("financial.csv: validar arquivo: %w (nenhuma linha de lançamento)", ErrInvalidCSV)
	}
	return out, nil
}

func parseBankRow(rec []string) (BankRecordInput, error) {
	date, err := parseCSVDate(strings.TrimSpace(rec[0]))
	if err != nil {
		return BankRecordInput{}, err
	}
	desc := strings.TrimSpace(rec[1])
	if desc == "" || len([]rune(desc)) > 255 {
		return BankRecordInput{}, fmt.Errorf("descrição deve ter entre 1 e 255 caracteres")
	}
	amount, err := strconv.ParseFloat(strings.TrimSpace(rec[2]), 64)
	if err != nil || math.IsNaN(amount) || math.IsInf(amount, 0) || amount <= 0 {
		return BankRecordInput{}, fmt.Errorf("valor deve ser positivo")
	}
	typ := strings.ToUpper(strings.TrimSpace(rec[3]))
	if typ != TypeCredit && typ != TypeDebit {
		return BankRecordInput{}, fmt.Errorf("tipo deve ser CREDIT ou DEBIT")
	}
	return BankRecordInput{Date: date, Description: desc, Amount: round2(amount), Type: typ}, nil
}

func parseCSVDate(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02", "02/01/2006"} {
		if d, err := time.Parse(layout, s); err == nil {
			return d, nil
		}
	}
	return time.Time{}, fmt.Errorf("data inválida %q", s)
}

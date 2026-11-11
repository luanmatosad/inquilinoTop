package financial

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	feePercent  float64
	gross       []PropertyGross
	transfers   map[uuid.UUID]*Transfer
	records     []BankRecord
	matchTarget *uuid.UUID // consumido na primeira chamada de MatchBankRecord
}

func newMockRepo() *mockRepo {
	return &mockRepo{transfers: map[uuid.UUID]*Transfer{}}
}

func (m *mockRepo) AdminFeePercent(_ context.Context, _ uuid.UUID) (float64, error) {
	return m.feePercent, nil
}

func (m *mockRepo) SetAdminFeePercent(_ context.Context, _ uuid.UUID, pct float64) error {
	m.feePercent = pct
	return nil
}

func (m *mockRepo) PaidRentByProperty(_ context.Context, _ uuid.UUID, _ string) ([]PropertyGross, error) {
	return m.gross, nil
}

func (m *mockRepo) InsertTransfers(_ context.Context, _ uuid.UUID, _ string, rows []Transfer) (int, error) {
	for i := range rows {
		t := rows[i]
		t.ID = uuid.New()
		m.transfers[t.ID] = &t
	}
	return len(rows), nil
}

func (m *mockRepo) ListTransfers(_ context.Context, _ uuid.UUID, _ TransferFilter) ([]Transfer, error) {
	out := []Transfer{}
	for _, t := range m.transfers {
		out = append(out, *t)
	}
	return out, nil
}

func (m *mockRepo) GetTransfer(_ context.Context, id, _ uuid.UUID) (*Transfer, error) {
	t, ok := m.transfers[id]
	if !ok {
		return nil, errors.New("not found")
	}
	cp := *t
	return &cp, nil
}

func (m *mockRepo) SaveTransfer(_ context.Context, _ uuid.UUID, t *Transfer, expectedStatus string) error {
	cur, ok := m.transfers[t.ID]
	if !ok || cur.Status != expectedStatus {
		return ErrConcurrentUpdate
	}
	cp := *t
	m.transfers[t.ID] = &cp
	return nil
}

// InsertBankRecord: duplicata devolve o id já existente com inserted=false (como o ON CONFLICT do repositório).
func (m *mockRepo) InsertBankRecord(_ context.Context, _ uuid.UUID, in BankRecordInput) (uuid.UUID, bool, error) {
	for _, r := range m.records {
		if r.Description == in.Description && r.Amount == in.Amount && r.Type == in.Type && r.Date.Equal(in.Date) {
			return r.ID, false, nil
		}
	}
	id := uuid.New()
	m.records = append(m.records, BankRecord{ID: id, Date: in.Date, Description: in.Description, Amount: in.Amount, Type: in.Type})
	return id, true, nil
}

func (m *mockRepo) MatchBankRecord(_ context.Context, _, _ uuid.UUID) (*uuid.UUID, error) {
	t := m.matchTarget
	m.matchTarget = nil
	return t, nil
}

func (m *mockRepo) ListBankRecords(_ context.Context, _ uuid.UUID, _ BankRecordFilter) ([]BankRecord, error) {
	return m.records, nil
}

func seedTransfer(m *mockRepo, status string, gross, fee, discounts float64) uuid.UUID {
	id := uuid.New()
	net := gross - fee - discounts
	m.transfers[id] = &Transfer{
		ID: id, Period: "2026-05", GrossAmount: gross, AdminFeePercent: 10,
		AdminFeeAmount: fee, Discounts: discounts, NetAmount: net, Status: status,
	}
	return id
}

func TestServiceCalcTransfer_TaxaSobreBruto(t *testing.T) {
	// Exemplo da spec: 3000 bruto, taxa 10% → 300 de taxa, 2700 líquido.
	fee, net, err := CalcTransfer(3000, 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 300.0, fee)
	assert.Equal(t, 2700.0, net)
}

func TestServiceCalcTransfer_DescontoReduzLiquido(t *testing.T) {
	fee, net, err := CalcTransfer(1000, 10, 50.5)
	require.NoError(t, err)
	assert.Equal(t, 100.0, fee)
	assert.Equal(t, 849.5, net)
}

func TestServiceCalcTransfer_ArredondaDuasCasas(t *testing.T) {
	// 333.33 × 7.5% = 24.99975 → 25.00; líquido 308.33.
	fee, net, err := CalcTransfer(333.33, 7.5, 0)
	require.NoError(t, err)
	assert.Equal(t, 25.0, fee)
	assert.Equal(t, 308.33, net)
}

func TestServiceCalcTransfer_DescontosMaioresQueBruto(t *testing.T) {
	_, _, err := CalcTransfer(1000, 10, 950)
	assert.ErrorIs(t, err, ErrDiscountsExceedGross)
}

func TestServiceCalcTransfer_DescontoNegativo(t *testing.T) {
	_, _, err := CalcTransfer(1000, 10, -1)
	assert.ErrorIs(t, err, ErrInvalidDiscounts)
}

func TestServiceGenerateTransfers_CalculaPorImovel(t *testing.T) {
	repo := newMockRepo()
	repo.feePercent = 10
	repo.gross = []PropertyGross{{PropertyID: uuid.New(), Gross: 3000}}
	svc := NewService(repo)

	n, err := svc.GenerateTransfers(context.Background(), uuid.New(), "2026-05")
	require.NoError(t, err)
	assert.Equal(t, 1, n)

	require.Len(t, repo.transfers, 1)
	for _, tr := range repo.transfers {
		assert.Equal(t, 300.0, tr.AdminFeeAmount)
		assert.Equal(t, 2700.0, tr.NetAmount)
		assert.Equal(t, StatusPending, tr.Status)
	}
}

func TestServiceGenerateTransfers_PeriodoInvalido(t *testing.T) {
	svc := NewService(newMockRepo())
	_, err := svc.GenerateTransfers(context.Background(), uuid.New(), "2026-13")
	assert.ErrorIs(t, err, ErrInvalidPeriod)
}

func TestServiceUpdateTransfer_FluxoPendingProcessedTransferred(t *testing.T) {
	repo := newMockRepo()
	id := seedTransfer(repo, StatusPending, 3000, 300, 0)
	svc := NewService(repo)
	org := uuid.New()

	processed := StatusProcessed
	tr, err := svc.UpdateTransfer(context.Background(), org, id, UpdateTransferInput{Status: &processed})
	require.NoError(t, err)
	assert.Equal(t, StatusProcessed, tr.Status)
	assert.Nil(t, tr.TransferredAt)

	transferred := StatusTransferred
	tr, err = svc.UpdateTransfer(context.Background(), org, id, UpdateTransferInput{Status: &transferred})
	require.NoError(t, err)
	assert.Equal(t, StatusTransferred, tr.Status)
	require.NotNil(t, tr.TransferredAt)
	assert.WithinDuration(t, time.Now(), *tr.TransferredAt, time.Minute)
}

func TestServiceUpdateTransfer_PularEtapaInvalido(t *testing.T) {
	repo := newMockRepo()
	id := seedTransfer(repo, StatusPending, 3000, 300, 0)
	svc := NewService(repo)

	transferred := StatusTransferred
	_, err := svc.UpdateTransfer(context.Background(), uuid.New(), id, UpdateTransferInput{Status: &transferred})
	assert.ErrorIs(t, err, ErrInvalidTransition)
}

func TestServiceUpdateTransfer_TransferredNaoVoltaAtras(t *testing.T) {
	repo := newMockRepo()
	id := seedTransfer(repo, StatusTransferred, 3000, 300, 0)
	svc := NewService(repo)

	pending := StatusPending
	_, err := svc.UpdateTransfer(context.Background(), uuid.New(), id, UpdateTransferInput{Status: &pending})
	assert.ErrorIs(t, err, ErrInvalidTransition)
}

func TestServiceUpdateTransfer_DescontoRecalculaLiquido(t *testing.T) {
	repo := newMockRepo()
	id := seedTransfer(repo, StatusPending, 3000, 300, 0)
	svc := NewService(repo)

	d := 100.0
	tr, err := svc.UpdateTransfer(context.Background(), uuid.New(), id, UpdateTransferInput{Discounts: &d})
	require.NoError(t, err)
	assert.Equal(t, 100.0, tr.Discounts)
	assert.Equal(t, 2600.0, tr.NetAmount)
}

func TestServiceUpdateTransfer_DescontoBloqueadoAposProcessar(t *testing.T) {
	repo := newMockRepo()
	id := seedTransfer(repo, StatusProcessed, 3000, 300, 0)
	svc := NewService(repo)

	d := 100.0
	_, err := svc.UpdateTransfer(context.Background(), uuid.New(), id, UpdateTransferInput{Discounts: &d})
	assert.ErrorIs(t, err, ErrTransferLocked)
}

func TestServiceImportBankRecords_DuplicataTentaConciliarDeNovo(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	day := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	row := BankRecordInput{Date: day, Description: "PIX ALUGUEL", Amount: 2500, Type: TypeCredit}

	// Primeira importação: sem pagamento correspondente ainda → fica sem conciliar.
	res, err := svc.ImportBankRecords(context.Background(), uuid.New(), []BankRecordInput{row})
	require.NoError(t, err)
	assert.Equal(t, 1, res.Imported)
	assert.Len(t, res.Unmatched, 1)

	// Reimportação depois que o pagamento virou PAID: não duplica, mas concilia o existente.
	pid := uuid.New()
	repo.matchTarget = &pid
	res, err = svc.ImportBankRecords(context.Background(), uuid.New(), []BankRecordInput{row})
	require.NoError(t, err)
	assert.Equal(t, 0, res.Imported)
	assert.Equal(t, 1, res.Duplicate)
	assert.Equal(t, 1, res.Matched)
	assert.Empty(t, res.Unmatched)
}

func TestServiceImportBankRecords_DebitoNaoConcilia(t *testing.T) {
	repo := newMockRepo()
	pid := uuid.New()
	repo.matchTarget = &pid // não deve ser usado para débito
	svc := NewService(repo)
	day := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)

	res, err := svc.ImportBankRecords(context.Background(), uuid.New(), []BankRecordInput{
		{Date: day, Description: "TARIFA", Amount: 12.5, Type: TypeDebit},
	})
	require.NoError(t, err)
	assert.Equal(t, 1, res.Imported)
	assert.Equal(t, 0, res.Matched)
	require.Len(t, res.Unmatched, 1)
	assert.Equal(t, "TARIFA", res.Unmatched[0].Description)
	assert.NotNil(t, repo.matchTarget, "débito não consome a tentativa de conciliação")
}

func TestServiceSetAdminFeePercent_ValidaFaixaEArredonda(t *testing.T) {
	repo := newMockRepo()
	svc := NewService(repo)
	ctx := context.Background()

	require.NoError(t, svc.SetAdminFeePercent(ctx, uuid.New(), 10.567))
	pct, err := svc.GetAdminFeePercent(ctx, uuid.New())
	require.NoError(t, err)
	assert.Equal(t, 10.57, pct)

	assert.ErrorIs(t, svc.SetAdminFeePercent(ctx, uuid.New(), -0.01), ErrInvalidAdminFee)
	assert.ErrorIs(t, svc.SetAdminFeePercent(ctx, uuid.New(), 100.01), ErrInvalidAdminFee)
	pct, err = svc.GetAdminFeePercent(ctx, uuid.New())
	require.NoError(t, err)
	assert.Equal(t, 10.57, pct, "valor inválido não pode sobrescrever a taxa")
}

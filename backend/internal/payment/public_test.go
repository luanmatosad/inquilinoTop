package payment_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockLinkStore guarda os links em memória, com a regra de um link ativo por cobrança.
type mockLinkStore struct {
	links map[string]*payment.PaymentLink // por token_hash
}

func newMockLinkStore() *mockLinkStore {
	return &mockLinkStore{links: map[string]*payment.PaymentLink{}}
}

func (m *mockLinkStore) RotateLink(_ context.Context, orgID, paymentID uuid.UUID, createdBy *uuid.UUID, hash string, exp time.Time) error {
	now := time.Now()
	for _, l := range m.links {
		if l.PaymentID == paymentID && l.RevokedAt == nil {
			l.RevokedAt = &now
		}
	}
	m.links[hash] = &payment.PaymentLink{ID: uuid.New(), OrganizationID: orgID, PaymentID: paymentID, CreatedBy: createdBy, ExpiresAt: exp}
	return nil
}

func (m *mockLinkStore) GetLinkByHash(_ context.Context, hash string) (*payment.PaymentLink, error) {
	l, ok := m.links[hash]
	if !ok {
		return nil, apierr.ErrNotFound
	}
	return l, nil
}

// mockReportStore aplica o aviso direto na cobrança do mock de repositório e grava o evento.
type mockReportStore struct {
	repo   *mockPaymentRepo
	events *mockEventStore
}

func (m *mockReportStore) SaveReport(ctx context.Context, orgID, paymentID uuid.UUID, in payment.ReportApply) (*string, error) {
	p, err := m.repo.GetByID(ctx, paymentID, orgID)
	if err != nil {
		return nil, err
	}
	old := p.ProofPath
	now := time.Now()
	amount, date := in.Amount, in.PaidDate
	p.ReportedAt, p.ReportedAmount, p.ReportedDate, p.ProofPath = &now, &amount, &date, in.ProofPath
	_, _ = m.events.AddEvent(ctx, orgID, paymentID, nil, payment.EventReported, nil, map[string]any{"amount": amount})
	return old, nil
}

func (m *mockReportStore) ClearReport(ctx context.Context, orgID, paymentID uuid.UUID, actor *uuid.UUID) (*string, error) {
	p, err := m.repo.GetByID(ctx, paymentID, orgID)
	if err != nil {
		return nil, err
	}
	old := p.ProofPath
	p.ReportedAt, p.ReportedAmount, p.ReportedDate, p.ProofPath = nil, nil, nil, nil
	_, _ = m.events.AddEvent(ctx, orgID, paymentID, actor, payment.EventRejected, nil, nil)
	return old, nil
}

type mockProofStorage struct {
	files   map[string][]byte
	deleted []string
}

func (m *mockProofStorage) Save(_ context.Context, ownerID uuid.UUID, filename string, r io.Reader) (string, error) {
	b, _ := io.ReadAll(r)
	path := ownerID.String() + "/" + uuid.NewString() + "-" + filename
	m.files[path] = b
	return path, nil
}

func (m *mockProofStorage) Load(_ context.Context, path string) (io.ReadCloser, error) {
	b, ok := m.files[path]
	if !ok {
		return nil, io.EOF
	}
	return io.NopCloser(bytes.NewReader(b)), nil
}

func (m *mockProofStorage) Delete(_ context.Context, path string) error {
	delete(m.files, path)
	m.deleted = append(m.deleted, path)
	return nil
}

type publicEnv struct {
	*testService
	p       *payment.Payment
	org     uuid.UUID
	user    uuid.UUID
	links   *mockLinkStore
	proofs  *mockProofStorage
	reports *mockReportStore
	events  *mockEventStore
}

func newPublicEnv(t *testing.T, due time.Time) *publicEnv {
	t.Helper()
	ts, p, org, user := registerSetup(t, due, "PF")
	// registerSetup liga um mockEventStore em ts.Service; recupera pelo serviço com um novo.
	events := newMockEventStore()
	links := newMockLinkStore()
	proofs := &mockProofStorage{files: map[string][]byte{}}
	reports := &mockReportStore{repo: ts.mockRepo, events: events}
	ts.Service.WithEvents(events).WithPublicLinks(links, "https://app.imoviflow.test").WithReports(reports, proofs)
	return &publicEnv{testService: ts, p: p, org: org, user: user, links: links, proofs: proofs, reports: reports, events: events}
}

func tokenFromURL(t *testing.T, url string) string {
	t.Helper()
	const prefix = "https://app.imoviflow.test/p/"
	require.True(t, strings.HasPrefix(url, prefix), url)
	return strings.TrimPrefix(url, prefix)
}

func (e *publicEnv) newLink(t *testing.T) string {
	t.Helper()
	res, err := e.CreateLink(context.Background(), e.p.ID, e.org, e.user)
	require.NoError(t, err)
	return tokenFromURL(t, res.URL)
}

var pngBytes = append([]byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}, make([]byte, 64)...)

func TestService_CreateLink_GuardaSóOHash(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	res, err := e.CreateLink(context.Background(), e.p.ID, e.org, e.user)
	require.NoError(t, err)
	token := tokenFromURL(t, res.URL)
	assert.GreaterOrEqual(t, len(token), 43, "32 bytes em base64url")

	sum := sha256.Sum256([]byte(token))
	_, ok := e.links.links[hex.EncodeToString(sum[:])]
	assert.True(t, ok, "o hash SHA-256 do token é o que fica guardado")
	_, plain := e.links.links[token]
	assert.False(t, plain, "o token nunca é guardado em claro")
}

func TestService_CreateLink_ValidadeVencimentoMais90Dias(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	res, err := e.CreateLink(context.Background(), e.p.ID, e.org, e.user)
	require.NoError(t, err)
	assert.Equal(t, time.Date(2027, 2, 3, 0, 0, 0, 0, time.UTC), res.ExpiresAt, "05/11 + 90 dias")
}

func TestService_CreateLink_VencimentoAntigoGarante30DiasDeHoje(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 1, 5, 0, 0, 0, 0, time.UTC))
	res, err := e.CreateLink(context.Background(), e.p.ID, e.org, e.user)
	require.NoError(t, err)
	assert.Equal(t, nov7.AddDate(0, 0, 30), res.ExpiresAt)
}

func TestService_CreateLink_RotacionaORevoga(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	first := e.newLink(t)
	second := e.newLink(t)
	require.NotEqual(t, first, second)

	_, err := e.PublicView(context.Background(), first)
	assert.ErrorIs(t, err, apierr.ErrNotFound, "o link antigo foi revogado")
	_, err = e.PublicView(context.Background(), second)
	assert.NoError(t, err)
}

func TestService_CreateLink_SemURLPública(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	ts.Service.WithPublicLinks(newMockLinkStore(), "")
	_, err := ts.CreateLink(context.Background(), p.ID, org, user)
	assert.ErrorIs(t, err, payment.ErrPublicURLNotConfigured)
}

func TestService_CreateLink_OutraOrganização(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	_, err := e.CreateLink(context.Background(), e.p.ID, uuid.New(), e.user)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_PublicView_TokenInválido(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	_, err := e.PublicView(context.Background(), "nao-existe")
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_PublicView_Expirado(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	e.Service.WithClock(func() time.Time { return time.Date(2027, 2, 4, 0, 0, 0, 0, time.UTC) })
	_, err := e.PublicView(context.Background(), token)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_PublicView_EmAbertoSemDadosSensíveis(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	v, err := e.PublicView(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, "Luan Matos", v.LandlordName)
	assert.Equal(t, 1850.0, v.Amount)
	assert.Equal(t, "PENDING", v.Status)
	require.NotNil(t, v.UnitLabel)
	assert.Equal(t, "Ap 302", *v.UnitLabel)

	raw, err := json.Marshal(v)
	require.NoError(t, err)
	body := string(raw)
	for _, forbidden := range []string{"lease_id", "tenant", "organization_id", "document", "email", "address", e.p.ID.String()} {
		assert.NotContains(t, body, forbidden)
	}
}

func TestService_PublicView_AtrasadaTrazValorAtualizado(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	v, err := e.PublicView(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, "LATE", v.Status)
	assert.Greater(t, v.Amount, 1850.0)
}

func TestService_PublicPix_ComValorDoDia(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	key := "luan@email.com"
	e.mockRepo.fc = &payment.FinancialConfig{PixKey: &key}
	token := e.newLink(t)
	code, err := e.PublicPix(context.Background(), token)
	require.NoError(t, err)
	assert.Contains(t, code.Payload, "br.gov.bcb.pix")
}

func TestService_PublicReceipt_SóDepoisDePaga(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	_, err := e.PublicReceipt(context.Background(), token)
	assert.True(t, e.IsNotPaid(err))

	_, err = pay(t, e.testService, e.p, e.org, e.user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	r, err := e.PublicReceipt(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, "0001/2026", r.Number)
	assert.Nil(t, r.Tenant.Document, "recibo público sem documento do inquilino")
	assert.Nil(t, r.Owner.Document, "recibo público sem documento do locador")
	assert.Nil(t, r.Unit.PropertyAddress, "recibo público sem endereço")
}

func TestService_PublicView_PagaMostraRecibo(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	_, err := pay(t, e.testService, e.p, e.org, e.user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	v, err := e.PublicView(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, "PAID", v.Status)
	require.NotNil(t, v.PaidDate)
	require.NotNil(t, v.ReceiptNumber)
	assert.Equal(t, "0001/2026", *v.ReceiptNumber)
}

func TestService_PublicView_PagaMantémLinkPor365Dias(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	_, err := pay(t, e.testService, e.p, e.org, e.user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	e.Service.WithClock(func() time.Time { return time.Date(2027, 6, 1, 0, 0, 0, 0, time.UTC) })
	_, err = e.PublicView(context.Background(), token)
	assert.NoError(t, err, "paga em 02/11/2026: o link vale até 02/11/2027")
}

func report(amount float64, date time.Time, proof []byte) payment.ReportInput {
	return payment.ReportInput{Amount: amount, PaidDate: date, Proof: proof}
}

func TestService_ReportPaid_Válido(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	err := e.ReportPaid(context.Background(), token, report(1850, time.Date(2026, 11, 6, 0, 0, 0, 0, time.UTC), nil))
	require.NoError(t, err)

	got, err := e.Get(context.Background(), e.p.ID, e.org)
	require.NoError(t, err)
	assert.True(t, got.AwaitingConfirmation)
	assert.Equal(t, "PENDING", got.Status, "o status gravado não muda")
	require.NotNil(t, got.ReportedAmount)
	assert.Equal(t, 1850.0, *got.ReportedAmount)

	v, err := e.PublicView(context.Background(), token)
	require.NoError(t, err)
	assert.Equal(t, "AWAITING_CONFIRMATION", v.Status)
	require.Len(t, e.events.events, 1)
	assert.Equal(t, payment.EventReported, e.events.events[0].Kind)
}

func TestService_ReportPaid_DataFutura(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	err := e.ReportPaid(context.Background(), token, report(1850, time.Date(2026, 11, 8, 0, 0, 0, 0, time.UTC), nil))
	assert.ErrorIs(t, err, payment.ErrInvalidPaidDate)
}

func TestService_ReportPaid_DataMuitoAntiga(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	err := e.ReportPaid(context.Background(), token, report(1850, time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC), nil))
	assert.ErrorIs(t, err, payment.ErrInvalidPaidDate)
}

func TestService_ReportPaid_ValorInválido(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	err := e.ReportPaid(context.Background(), token, report(0, nov7, nil))
	assert.ErrorIs(t, err, payment.ErrInvalidReport)
}

func TestService_ReportPaid_CobrançaPaga(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	_, err := pay(t, e.testService, e.p, e.org, e.user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	err = e.ReportPaid(context.Background(), token, report(1850, nov7, nil))
	assert.True(t, e.IsAlreadyPaid(err))
	assert.Empty(t, e.events.events, "nada é gravado")
}

func TestService_ReportPaid_ComprovantePNG(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	require.NoError(t, e.ReportPaid(context.Background(), token, report(1850, nov7, pngBytes)))
	got, err := e.Get(context.Background(), e.p.ID, e.org)
	require.NoError(t, err)
	assert.True(t, got.HasProof)
	require.NotNil(t, got.ProofPath)
	assert.True(t, strings.HasSuffix(*got.ProofPath, ".png"), "extensão vem do tipo detectado: %s", *got.ProofPath)
	assert.True(t, strings.HasPrefix(*got.ProofPath, e.org.String()+"/"))
}

func TestService_ReportPaid_ComprovanteGrande(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	big := append([]byte("%PDF-1.4\n"), make([]byte, payment.MaxProofBytes)...)
	err := e.ReportPaid(context.Background(), token, report(1850, nov7, big))
	assert.ErrorIs(t, err, payment.ErrProofTooLarge)
}

func TestService_ReportPaid_ComprovanteTipoFalso(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	exe := append([]byte("MZ"), make([]byte, 200)...)
	err := e.ReportPaid(context.Background(), token, report(1850, nov7, exe))
	assert.ErrorIs(t, err, payment.ErrProofType)
	assert.Empty(t, e.proofs.files, "nada é gravado")
}

func TestService_ReportPaid_NovoAvisoSubstituiComprovante(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	require.NoError(t, e.ReportPaid(context.Background(), token, report(1850, nov7, pngBytes)))
	first := *e.mockRepo.payments[e.p.ID].ProofPath
	require.NoError(t, e.ReportPaid(context.Background(), token, report(1850, nov7, pngBytes)))
	assert.Contains(t, e.proofs.deleted, first, "o comprovante antigo é apagado")
	assert.Len(t, e.proofs.files, 1)
}

func TestService_ConfirmReport_BaixaPeloAviso(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	paid := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	require.NoError(t, e.ReportPaid(context.Background(), token, report(1850, paid, nil)))

	got, err := e.ConfirmReport(context.Background(), e.p.ID, e.org, e.user, payment.ConfirmInput{})
	require.NoError(t, err)
	assert.Equal(t, "PAID", got.Status)
	assert.Equal(t, paid, *got.PaidDate)
	assert.Equal(t, "PIX", *got.PaymentMethod)
	require.NotNil(t, got.ReceiptNumber)
}

func TestService_ConfirmReport_SemAviso(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	_, err := e.ConfirmReport(context.Background(), e.p.ID, e.org, e.user, payment.ConfirmInput{})
	assert.ErrorIs(t, err, payment.ErrNoPendingReport)
}

func TestService_RejectReport_LimpaEApagaComprovante(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	require.NoError(t, e.ReportPaid(context.Background(), token, report(1850, nov7, pngBytes)))

	require.NoError(t, e.RejectReport(context.Background(), e.p.ID, e.org, e.user))
	got, err := e.Get(context.Background(), e.p.ID, e.org)
	require.NoError(t, err)
	assert.False(t, got.AwaitingConfirmation)
	assert.Nil(t, got.ReportedAt)
	assert.Empty(t, e.proofs.files)
	assert.Equal(t, payment.EventRejected, e.events.events[len(e.events.events)-1].Kind)

	assert.ErrorIs(t, e.RejectReport(context.Background(), e.p.ID, e.org, e.user), payment.ErrNoPendingReport)
}

func TestService_ProofFile_EscopoDaOrganização(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	require.NoError(t, e.ReportPaid(context.Background(), token, report(1850, nov7, pngBytes)))

	rc, ctype, err := e.ProofFile(context.Background(), e.p.ID, e.org)
	require.NoError(t, err)
	defer rc.Close()
	assert.Equal(t, "image/png", ctype)

	_, _, err = e.ProofFile(context.Background(), e.p.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

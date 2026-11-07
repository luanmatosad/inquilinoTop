package payment_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type captureIRRF struct{ base float64 }

func (c *captureIRRF) Calculate(_ context.Context, base float64, _ time.Time) (float64, error) {
	c.base = base
	return 100, nil
}

// registerSetup cria uma cobrança de R$ 1.850,00 com vencimento em due, num contrato com multa de 2% e juros de 0,033333%/dia.
func registerSetup(t *testing.T, due time.Time, personType string) (*testService, *payment.Payment, uuid.UUID, uuid.UUID) {
	t.Helper()
	ts, _ := newEventsService(t, nov7)
	org, user := uuid.New(), uuid.New()
	leaseID, unitID := uuid.New(), uuid.New()
	setupLease(ts, leaseID, org, 2, 0.033333)
	l := ts.leaseReader.leases[leaseID]
	l.UnitID = unitID
	ts.tenantReader.tenants[l.TenantID] = &tenant.Tenant{ID: l.TenantID, OrganizationID: org, Name: "Marina Souza", PersonType: personType}
	label := "Ap 302"
	ts.unitReader.units[unitID] = &payment.UnitSummary{ID: unitID, Label: &label}
	ts.ownerReader.owners[user] = &payment.OwnerSummary{ID: user, Name: "Luan Matos"}
	p, err := ts.Create(context.Background(), user, org, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: due, GrossAmount: 1850, Type: "RENT",
	})
	require.NoError(t, err)
	return ts, p, org, user
}

func pay(t *testing.T, ts *testService, p *payment.Payment, org, user uuid.UUID, paid time.Time, in payment.UpdatePaymentInput) (*payment.Payment, error) {
	t.Helper()
	in.Status = "PAID"
	in.PaidDate = &paid
	in.GrossAmount = p.GrossAmount
	return ts.UpdateBy(context.Background(), p.ID, org, user, in)
}

func str(s string) *string { return &s }

func TestService_BaixaComFormaEObservação(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	paid, err := pay(t, ts, p, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC),
		payment.UpdatePaymentInput{PaymentMethod: str("CASH"), PaymentNote: str("pagou na portaria")})
	require.NoError(t, err)
	assert.Equal(t, "PAID", paid.Status)
	assert.Equal(t, "CASH", *paid.PaymentMethod)
	assert.Equal(t, "pagou na portaria", *paid.PaymentNote)
}

func TestService_BaixaComDesconto(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	paid, err := pay(t, ts, p, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC),
		payment.UpdatePaymentInput{DiscountAmount: 50})
	require.NoError(t, err)
	assert.Equal(t, 50.0, paid.DiscountAmount)
	require.NotNil(t, paid.NetAmount)
	assert.InDelta(t, 1800, *paid.NetAmount, 0.001)
}

func TestService_BaixaComDesconto_AtrasoSomaMultaEJuros(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), "PF")
	paid, err := pay(t, ts, p, org, user, time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC),
		payment.UpdatePaymentInput{DiscountAmount: 41.93})
	require.NoError(t, err)
	// 1850 + multa 37,00 + juros 4,93 (8 dias) - desconto 41,93
	assert.InDelta(t, 37.0, paid.LateFeeAmount, 0.001)
	assert.InDelta(t, 4.93, paid.InterestAmount, 0.001)
	assert.InDelta(t, 1850.0, *paid.NetAmount, 0.001)
}

func TestService_DescontoMaiorQueODevido(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	_, err := pay(t, ts, p, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC),
		payment.UpdatePaymentInput{DiscountAmount: 1850.01})
	assert.ErrorIs(t, err, payment.ErrInvalidDiscount)
	assert.Equal(t, "PENDING", ts.mockRepo.payments[p.ID].Status, "não paga")

	_, err = pay(t, ts, p, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC),
		payment.UpdatePaymentInput{DiscountAmount: -1})
	assert.ErrorIs(t, err, payment.ErrInvalidDiscount)
}

func TestService_IRRFUsaOValorSemODesconto(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PJ")
	capture := &captureIRRF{}
	svc := payment.NewService(ts.mockRepo, ts.leaseReader, ts.tenantReader, ts.unitReader, ts.ownerReader, capture)

	paid := time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)
	out, err := svc.UpdateBy(context.Background(), p.ID, org, user, payment.UpdatePaymentInput{
		Status: "PAID", PaidDate: &paid, GrossAmount: 1850, DiscountAmount: 50,
	})
	require.NoError(t, err)
	assert.InDelta(t, 1800, capture.base, 0.001, "base do IRRF = devido - desconto")
	assert.InDelta(t, 100, out.IRRFAmount, 0.001)
	assert.InDelta(t, 1700, *out.NetAmount, 0.001, "líquido = devido - desconto - IRRF")
}

func TestService_Recibo_NumeraçãoSequencialPorOrganizaçãoEAno(t *testing.T) {
	ts, p1, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	p2, err := ts.Create(context.Background(), user, org, payment.CreatePaymentInput{LeaseID: p1.LeaseID, DueDate: time.Date(2026, 12, 5, 0, 0, 0, 0, time.UTC), GrossAmount: 1850, Type: "RENT"})
	require.NoError(t, err)
	p3, err := ts.Create(context.Background(), user, org, payment.CreatePaymentInput{LeaseID: p1.LeaseID, DueDate: time.Date(2027, 1, 5, 0, 0, 0, 0, time.UTC), GrossAmount: 1850, Type: "RENT"})
	require.NoError(t, err)

	_, err = pay(t, ts, p1, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	_, err = pay(t, ts, p2, org, user, time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	_, err = pay(t, ts, p3, org, user, time.Date(2027, 1, 3, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)

	for id, want := range map[uuid.UUID]string{p1.ID: "0001/2026", p2.ID: "0002/2026", p3.ID: "0001/2027"} {
		r, err := ts.BuildReceipt(context.Background(), id, org, user)
		require.NoError(t, err)
		assert.Equal(t, want, r.Number)
	}
}

func TestService_Recibo_NúmeroEstável(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	_, err := pay(t, ts, p, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), payment.UpdatePaymentInput{})
	require.NoError(t, err)
	a, err := ts.BuildReceipt(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	b, err := ts.BuildReceipt(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Equal(t, a.Number, b.Number)
}

func TestService_Recibo_PagaAntesDaNumeraçãoRecebeNaPrimeiraEmissão(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	// pago "à moda antiga": status e data, sem número
	d := time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC)
	stored := ts.mockRepo.payments[p.ID]
	stored.Status, stored.PaidDate = "PAID", &d
	net := 1850.0
	stored.NetAmount = &net

	r, err := ts.BuildReceipt(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Equal(t, "0001/2026", r.Number)
}

func TestService_Recibo_TrazFormaEDesconto(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	_, err := pay(t, ts, p, org, user, time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC),
		payment.UpdatePaymentInput{PaymentMethod: str("PIX"), DiscountAmount: 50})
	require.NoError(t, err)
	r, err := ts.BuildReceipt(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Equal(t, "PIX", *r.PaymentMethod)
	assert.Equal(t, 50.0, r.Amounts.Discount)
}

func putPayment(t *testing.T, ts *testService, org, user uuid.UUID, id uuid.UUID, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPut, "/payments/"+id.String(), bytes.NewReader(raw))
	rr := httptest.NewRecorder()
	eventsRouter(ts, org, user).ServeHTTP(rr, req)
	return rr
}

func TestHandler_Put_DescontoMaiorQueODevido_400(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	rr := putPayment(t, ts, org, user, p.ID, map[string]any{
		"status": "PAID", "paid_date": "2026-11-02T00:00:00Z", "gross_amount": 1850, "discount_amount": 2000,
	})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Contains(t, rr.Body.String(), "INVALID_DISCOUNT")
}

func TestHandler_Put_FormaInválida_400(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	rr := putPayment(t, ts, org, user, p.ID, map[string]any{
		"status": "PAID", "paid_date": "2026-11-02T00:00:00Z", "gross_amount": 1850, "payment_method": "BITCOIN",
	})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Put_FormaEDesconto_ReciboComNúmero(t *testing.T) {
	ts, p, org, user := registerSetup(t, time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC), "PF")
	rr := putPayment(t, ts, org, user, p.ID, map[string]any{
		"status": "PAID", "paid_date": "2026-11-02T00:00:00Z", "gross_amount": 1850,
		"payment_method": "PIX", "discount_amount": 50, "payment_note": "ok",
	})
	require.Equal(t, http.StatusOK, rr.Code)

	req := httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/receipt", nil)
	rec := httptest.NewRecorder()
	eventsRouter(ts, org, user).ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"number":"0001/2026"`)
	assert.Contains(t, rec.Body.String(), `"payment_method":"PIX"`)
	assert.Contains(t, rec.Body.String(), `"discount":50`)
}

var _ = tenant.Tenant{}

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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var nov12 = time.Date(2026, 11, 12, 0, 0, 0, 0, time.UTC)

func lateSetup(t *testing.T) (*testService, *payment.Payment, uuid.UUID, uuid.UUID) {
	t.Helper()
	// vencida em 30/10; hoje (07/11) tem 8 dias de atraso: 1850 + 37,00 + 4,93 = 1891,93
	return registerSetup(t, time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), "PF")
}

func TestService_Acordo_NovaDataEValorPadrãoÉOTotalDeHoje(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	out, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12})
	require.NoError(t, err)

	assert.Equal(t, nov12, out.DueDate)
	assert.InDelta(t, 1891.93, out.GrossAmount, 0.01)
	assert.Equal(t, "PENDING", out.Status, "deixa de estar atrasada")
	require.NotNil(t, out.OriginalDueDate)
	assert.Equal(t, time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), *out.OriginalDueDate)
}

func TestService_Acordo_ValorCombinado(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	v := 1700.0
	out, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12, AgreedAmount: &v})
	require.NoError(t, err)
	assert.Equal(t, 1700.0, out.GrossAmount)
}

func TestService_Acordo_DataInválida(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	for _, d := range []time.Time{
		time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC), // hoje
		time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC), // passado
	} {
		_, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: d})
		assert.ErrorIs(t, err, payment.ErrInvalidAgreementDate, d.String())
	}
	assert.Equal(t, time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), ts.mockRepo.payments[p.ID].DueDate, "nada muda")
}

func TestService_Acordo_ValorInválido(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	zero := 0.0
	_, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12, AgreedAmount: &zero})
	assert.ErrorIs(t, err, payment.ErrInvalidAgreement)
}

func TestService_Acordo_CobrançaPaga(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	ts.mockRepo.payments[p.ID].Status = "PAID"
	_, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12})
	assert.True(t, ts.IsAlreadyPaid(err))
}

func TestService_Acordo_ComCobrançaDoProvedor(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	id := "ch_1"
	ts.mockRepo.payments[p.ID].ChargeID = &id
	_, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12})
	assert.ErrorIs(t, err, payment.ErrPaymentHasCharge)
}

func TestService_Acordo_GravaEventoComValoresAnteriores(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	_, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12, Note: str("combinado por WhatsApp")})
	require.NoError(t, err)
	last := ts.mockRepo.lastAgreement
	require.NotNil(t, last)
	assert.Equal(t, time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC), last.OldDueDate)
	assert.Equal(t, 1850.0, last.OldGross)
	assert.Equal(t, "combinado por WhatsApp", *last.Note)
}

func TestService_Acordo_VoltaAAtrasarNaNovaData(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	_, err := ts.Agree(context.Background(), p.ID, org, user, payment.AgreementInput{NewDueDate: nov12})
	require.NoError(t, err)

	// 20 dias depois, sem pagamento: LATE de novo, com multa contada a partir de 12/11.
	ts.Service.WithClock(func() time.Time { return time.Date(2026, 11, 22, 12, 0, 0, 0, time.UTC) })
	got, err := ts.Get(context.Background(), p.ID, org)
	require.NoError(t, err)
	assert.InDelta(t, 1891.93*0.02, got.LateFeeAmount, 0.02)
	assert.Greater(t, got.InterestAmount, 0.0)
	assert.True(t, got.LateFeeAmount > 0)
}

func postAgreement(t *testing.T, ts *testService, org, user, id uuid.UUID, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/payments/"+id.String()+"/agreement", bytes.NewReader(raw))
	rr := httptest.NewRecorder()
	eventsRouter(ts, org, user).ServeHTTP(rr, req)
	return rr
}

func TestHandler_Acordo_200(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	rr := postAgreement(t, ts, org, user, p.ID, map[string]any{"new_due_date": "2026-11-12T00:00:00Z", "agreed_amount": 1700, "note": "ok"})
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"gross_amount":1700`)
}

func TestHandler_Acordo_DataInválida_400(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	rr := postAgreement(t, ts, org, user, p.ID, map[string]any{"new_due_date": "2026-11-07T00:00:00Z"})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Contains(t, rr.Body.String(), "INVALID_AGREEMENT_DATE")
}

func TestHandler_Acordo_BodyInválido_400(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	rr := postAgreement(t, ts, org, user, p.ID, map[string]any{"agreed_amount": 1700})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Acordo_Paga_409(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	ts.mockRepo.payments[p.ID].Status = "PAID"
	rr := postAgreement(t, ts, org, user, p.ID, map[string]any{"new_due_date": "2026-11-12T00:00:00Z"})
	assert.Equal(t, http.StatusConflict, rr.Code)
}

func TestHandler_Acordo_ComCobrança_409(t *testing.T) {
	ts, p, org, user := lateSetup(t)
	id := "ch_1"
	ts.mockRepo.payments[p.ID].ChargeID = &id
	rr := postAgreement(t, ts, org, user, p.ID, map[string]any{"new_due_date": "2026-11-12T00:00:00Z"})
	assert.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "PAYMENT_HAS_CHARGE")
}

func TestHandler_Acordo_OutraOrganização_404(t *testing.T) {
	ts, p, _, user := lateSetup(t)
	rr := postAgreement(t, ts, uuid.New(), user, p.ID, map[string]any{"new_due_date": "2026-11-12T00:00:00Z"})
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

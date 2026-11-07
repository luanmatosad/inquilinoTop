package payment_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/pix"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func pixSetup(t *testing.T, key *string, due time.Time) (*testService, *payment.Payment, uuid.UUID, uuid.UUID) {
	t.Helper()
	ts, _ := newEventsService(t, nov7)
	org, user := uuid.New(), uuid.New()
	leaseID, unitID := uuid.New(), uuid.New()

	setupLease(ts, leaseID, org, 2, 0.033333)
	ts.leaseReader.leases[leaseID].UnitID = unitID
	city := "São Paulo"
	label := "Ap 302"
	ts.unitReader.units[unitID] = &payment.UnitSummary{ID: unitID, Label: &label, PropertyCity: &city}
	ts.ownerReader.owners[user] = &payment.OwnerSummary{ID: user, Name: "Luan Matos de Abreu Dias"}
	if key != nil {
		ts.mockRepo.fc = &payment.FinancialConfig{OrganizationID: org, PixKey: key, IsActive: true}
	}

	p, err := ts.Create(context.Background(), user, org, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: due, GrossAmount: 1850, Type: "RENT",
	})
	require.NoError(t, err)
	return ts, p, org, user
}

func TestService_PixPayload_EmDia(t *testing.T) {
	key := "123e4567-e89b-12d3-a456-426614174000"
	ts, p, org, user := pixSetup(t, &key, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))

	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Equal(t, 1850.0, code.Amount)
	assert.Contains(t, code.Payload, "54071850.00")
	assert.Contains(t, code.Payload, key)
	assert.Contains(t, code.Payload, "5924LUAN MATOS DE ABREU DIAS")
	assert.Contains(t, code.Payload, "6009SAO PAULO")
	assert.Equal(t, pix.CRC16(code.Payload[:len(code.Payload)-4]), code.Payload[len(code.Payload)-4:])
}

func TestService_PixPayload_AtrasadaUsaTotalAtualizado(t *testing.T) {
	key := "11999998888"
	ts, p, org, user := pixSetup(t, &key, time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC))

	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	// 8 dias de atraso (30/10 a 07/11): multa 2% (37,00) + juros 0,033333%/dia (4,93).
	assert.InDelta(t, 1891.93, code.Amount, 0.02)
	assert.Contains(t, code.Payload, "5407")
}

func TestService_PixPayload_SemChave(t *testing.T) {
	ts, p, org, user := pixSetup(t, nil, nov7)
	_, err := ts.PixPayload(context.Background(), p.ID, org, user)
	assert.ErrorIs(t, err, payment.ErrPixKeyNotConfigured)

	empty := "  "
	ts2, p2, org2, user2 := pixSetup(t, &empty, nov7)
	_, err = ts2.PixPayload(context.Background(), p2.ID, org2, user2)
	assert.ErrorIs(t, err, payment.ErrPixKeyNotConfigured)
}

func TestService_PixPayload_CobrançaPaga(t *testing.T) {
	key := "a@b.com"
	ts, p, org, user := pixSetup(t, &key, nov7)
	ts.mockRepo.payments[p.ID].Status = "PAID"
	_, err := ts.PixPayload(context.Background(), p.ID, org, user)
	assert.True(t, ts.IsAlreadyPaid(err))
}

func TestService_PixPayload_SemCidadeUsaBrasil(t *testing.T) {
	key := "a@b.com"
	ts, p, org, user := pixSetup(t, &key, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	for _, u := range ts.unitReader.units {
		u.PropertyCity = nil
	}
	code, err := ts.PixPayload(context.Background(), p.ID, org, user)
	require.NoError(t, err)
	assert.Contains(t, code.Payload, "6006BRASIL")
}

var _ = lease.Lease{}

func TestHandler_Pix_200(t *testing.T) {
	key := "a@b.com"
	ts, p, org, user := pixSetup(t, &key, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	r := eventsRouter(ts, org, user)
	req := httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/pix", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)
	assert.True(t, strings.Contains(rr.Body.String(), `"payload":"000201`))
}

func TestHandler_Pix_SemChave_422(t *testing.T) {
	ts, p, org, user := pixSetup(t, nil, nov7)
	r := eventsRouter(ts, org, user)
	req := httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/pix", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusUnprocessableEntity, rr.Code)
	assert.Contains(t, rr.Body.String(), "PIX_KEY_NOT_CONFIGURED")
}

func TestHandler_Pix_Paga_409(t *testing.T) {
	key := "a@b.com"
	ts, p, org, user := pixSetup(t, &key, nov7)
	ts.mockRepo.payments[p.ID].Status = "PAID"
	r := eventsRouter(ts, org, user)
	req := httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/pix", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusConflict, rr.Code)
}

func TestHandler_Pix_OutraOrganização_404(t *testing.T) {
	key := "a@b.com"
	ts, p, _, user := pixSetup(t, &key, nov7)
	r := eventsRouter(ts, uuid.New(), user)
	req := httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/pix", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

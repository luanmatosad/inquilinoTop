package payment_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type contextKey string

const ownerIDKey contextKey = "owner_id"

func contextWithOwnerID(ctx context.Context, ownerID uuid.UUID) context.Context {
	return context.WithValue(ctx, ownerIDKey, ownerID)
}

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func noopAuthMWWithOwnerID(ownerID uuid.UUID) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), ownerIDKey, ownerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func newTestHandler() *payment.Handler {
	svc := newTestService()
	return payment.NewHandler(svc.Service)
}

func TestHandler_ListByLease_IDInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByLease_Válido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/leases/"+leaseID.String()+"/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	data, ok := body["data"]
	require.True(t, ok)
	assert.NotNil(t, data)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_LeaseIDInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/leases/"+leaseID.String()+"/payments", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"due_date":     time.Now(),
		"gross_amount": 1500.0,
		"type":         "RENT",
	})
	req := httptest.NewRequest(http.MethodPost, "/leases/"+leaseID.String()+"/payments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/payments/"+uuid.New().String(), strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func setupLeaseInHandler(ts *testService, leaseID, ownerID uuid.UUID) {
	l := &lease.Lease{
		ID:         leaseID,
		OwnerID:    ownerID,
		TenantID:   uuid.New(),
		StartDate:  time.Now().AddDate(0, -6, 0),
		RentAmount: 2000,
		Status:     "ACTIVE",
	}
	ts.leaseReader.leases[leaseID] = l

	t := &tenant.Tenant{
		ID:         l.TenantID,
		OwnerID:    ownerID,
		Name:       "Tenant Test",
		PersonType: "PF",
	}
	ts.addTenant(t)
}

func seedPendingPayment(ts *testService, ownerID uuid.UUID) *payment.Payment {
	leaseID := uuid.New()
	setupLeaseInHandler(ts, leaseID, ownerID)

	p, _ := ts.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	return p
}

func TestHandler_Generate_MonthInválido(t *testing.T) {
	ts := newTestService()
	h := payment.NewHandler(ts.Service)
	ownerID := uuid.New()

	r := chi.NewRouter()
	r.With(noopAuthMWWithOwnerID(ownerID)).Post("/leases/{leaseId}/payments/generate", h.Generate)

	leaseID := uuid.New()
	setupLeaseInHandler(ts, leaseID, ownerID)

	req := httptest.NewRequest("POST", "/leases/"+leaseID.String()+"/payments/generate?month=abril", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "INVALID_MONTH")
}

func TestHandler_Generate_RouteExists(t *testing.T) {
	ts := newTestService()
	h := payment.NewHandler(ts.Service)
	ownerID := uuid.New()

	r := chi.NewRouter()
	r.With(noopAuthMWWithOwnerID(ownerID)).Post("/leases/{leaseId}/payments/generate", h.Generate)

	leaseID := uuid.New()
	setupLeaseInHandler(ts, leaseID, ownerID)

	req := httptest.NewRequest("POST", "/leases/"+leaseID.String()+"/payments/generate?month=2026-04", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)
	require.NotEqual(t, http.StatusMethodNotAllowed, w.Code)
	require.NotEqual(t, http.StatusNotFound, w.Code)
}

func TestHandler_HandleWebhook_RejectsWhenSecretNotConfigured(t *testing.T) {
	t.Helper()
	t.Setenv("WEBHOOK_SECRET", "")

	ts := newTestService()
	h := payment.NewHandler(ts.Service)

	body := `{"event":"PAYMENT_RECEIVED","chargeId":"ch_123","amount":100.0,"paymentDate":"2024-01-01T00:00:00Z"}`
	req := httptest.NewRequest(http.MethodPost, "/webhook/asaas", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Secret", "any-value")
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestHandler_HandleWebhook_AcceptsWithCorrectSecret(t *testing.T) {
	t.Helper()
	t.Setenv("WEBHOOK_SECRET", "secret123")

	ts := newTestService()
	h := payment.NewHandler(ts.Service)
	ownerID := uuid.New()

	// Set up a payment with a chargeID so webhook processing succeeds
	chargeID := "ch_123"
	leaseID := uuid.New()
	p, _ := ts.Create(context.Background(), ownerID, payment.CreatePaymentInput{
		LeaseID: leaseID, DueDate: time.Now(), GrossAmount: 1000, Type: "RENT",
	})
	ts.mockRepo.payments[p.ID].ChargeID = &chargeID

	body := `{"event":"PAYMENT_RECEIVED","chargeId":"ch_123"}`
	req := httptest.NewRequest(http.MethodPost, "/webhook/asaas", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Secret", "secret123")
	rr := httptest.NewRecorder()

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_ListByOwner_Vazio(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	assert.NotNil(t, body["data"])
}

func TestHandler_ListByOwner_ComFiltroStatus(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/payments?status=PENDING", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

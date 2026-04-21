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

	req := httptest.NewRequest(http.MethodGet, "/api/v1/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByLease_Válido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/leases/"+leaseID.String()+"/payments", nil)
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

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_LeaseIDInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/"+leaseID.String()+"/payments", strings.NewReader("not-json"))
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
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/"+leaseID.String()+"/payments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	h := newTestHandler()
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/payments/"+uuid.New().String(), strings.NewReader("not-json"))
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

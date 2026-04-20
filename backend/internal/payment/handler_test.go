package payment_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func TestHandler_ListByLease_IDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByLease_Válido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
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
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_LeaseIDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/nao-e-uuid/payments", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/"+leaseID.String()+"/payments", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	leaseID := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"due_date": time.Now(),
		"amount":   1500.0,
		"type":     "RENT",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/leases/"+leaseID.String()+"/payments", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/payments/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	svc := payment.NewService(newMockPaymentRepo())
	h := payment.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/payments/"+uuid.New().String(), strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

package expense_test

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
	"github.com/inquilinotop/api/internal/expense"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func TestHandler_ListByUnit_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/nao-e-uuid/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByUnit_Válido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	unitID := uuid.New()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/units/"+unitID.String()+"/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)

	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	data, ok := body["data"]
	require.True(t, ok)
	assert.NotNil(t, data)
}

func TestHandler_Create_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/units/nao-e-uuid/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	unitID := uuid.New()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/units/"+unitID.String()+"/expenses", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	unitID := uuid.New()
	body, _ := json.Marshal(map[string]interface{}{
		"description": "Conta de água",
		"amount":      150.0,
		"due_date":    time.Now(),
		"category":    "WATER",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/units/"+unitID.String()+"/expenses", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/expenses/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_BodyInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/expenses/"+uuid.New().String(), strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/expenses/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_NãoEncontrado(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/expenses/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	// mock retorna erro genérico (não apierr.ErrNotFound), então 500
	assert.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestHandler_Delete_Válido(t *testing.T) {
	mock := newMockExpenseRepo()
	svc := expense.NewService(mock)
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	// noopAuthMW não injeta ownerID, então OwnerIDFromCtx retorna uuid.Nil
	ownerID := uuid.Nil
	unitID := uuid.New()
	e, _ := svc.Create(context.Background(), ownerID, expense.CreateExpenseInput{
		UnitID: unitID, Description: "Luz", Amount: 100, DueDate: time.Now(), Category: "ELECTRICITY",
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/expenses/"+e.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_ListByOwner_Vazio(t *testing.T) {
	svc := expense.NewService(newMockExpenseRepo())
	h := expense.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/expenses", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	assert.NotNil(t, body["data"])
}

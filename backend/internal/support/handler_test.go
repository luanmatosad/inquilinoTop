package support_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/support"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func newRouter() (chi.Router, *support.Handler) {
	svc := support.NewService(newMockRepo())
	h := support.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	return r, h
}

func TestHandler_List_Vazio(t *testing.T) {
	r, _ := newRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tickets", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	data, ok := body["data"]
	require.True(t, ok)
	assert.NotNil(t, data)
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	r, _ := newRouter()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tickets", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_TipoInválido(t *testing.T) {
	r, _ := newRouter()
	body, _ := json.Marshal(map[string]interface{}{
		"tipo":      "INVALIDO",
		"assunto":   "Teste",
		"descricao": "Descrição válida",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tickets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	r, _ := newRouter()
	body, _ := json.Marshal(map[string]interface{}{
		"tipo":      "BUG",
		"assunto":   "Erro no login",
		"descricao": "Ao tentar logar, retorna 401 sem motivo aparente",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tickets", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_GetByID_IDInválido(t *testing.T) {
	r, _ := newRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tickets/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_GetByID_NãoEncontrado(t *testing.T) {
	r, _ := newRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/tickets/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

// mockRepoInternalErr overrides GetByID to return a generic (non-NotFound) error,
// simulating a DB failure. Used to verify the handler returns 500, not 404.
type mockRepoInternalErr struct {
	*mockRepo
}

func (m *mockRepoInternalErr) GetByID(_ context.Context, _ uuid.UUID, _ uuid.UUID) (*support.Ticket, error) {
	return nil, errors.New("database connection reset")
}

func TestHandler_GetByID_ErroInterno_Retorna500(t *testing.T) {
	mock := &mockRepoInternalErr{newMockRepo()}
	svc := support.NewService(mock)
	h := support.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tickets/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusInternalServerError, rr.Code)
}

func TestHandler_GetByID_Válido(t *testing.T) {
	mock := newMockRepo()
	svc := support.NewService(mock)
	h := support.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	// noopAuthMW não injeta userID → OwnerIDFromCtx retorna uuid.Nil
	userID := uuid.Nil
	ticket, _ := svc.Create(nil, userID, support.CreateTicketInput{ //nolint:staticcheck
		Tipo: "FEATURE", Assunto: "Melhoria", Descricao: "Adicionar dark mode",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/tickets/"+ticket.ID.String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

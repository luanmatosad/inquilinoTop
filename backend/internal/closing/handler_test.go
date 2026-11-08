package closing_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/internal/closing"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newRouter(t *testing.T, withOrg bool) http.Handler {
	t.Helper()
	svc, _, _ := newSvc(october())
	h := closing.NewHandler(svc)
	r := chi.NewRouter()
	pass := func(next http.Handler) http.Handler { return next }
	h.Register(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if withOrg {
				req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), user, org, "admin"))
			}
			next.ServeHTTP(w, req)
		})
	}, pass, pass)
	return r
}

func do(h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

type envelope struct {
	Data  closing.Closing `json:"data"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func decode(t *testing.T, rr *httptest.ResponseRecorder) envelope {
	t.Helper()
	var e envelope
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &e), rr.Body.String())
	return e
}

func TestHandler_Get_Aberto(t *testing.T) {
	h := newRouter(t, true)
	rr := do(h, http.MethodGet, "/closings?month=2026-10", nil)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	e := decode(t, rr)
	assert.Equal(t, "OPEN", e.Data.Status)
	assert.Equal(t, 5, e.Data.Snapshot.Forecast.Count)
}

func TestHandler_Get_MesInvalido(t *testing.T) {
	h := newRouter(t, true)
	for _, p := range []string{"/closings", "/closings?month=2026-13"} {
		rr := do(h, http.MethodGet, p, nil)
		assert.Equal(t, http.StatusBadRequest, rr.Code, p)
		assert.Equal(t, "INVALID_MONTH", decode(t, rr).Error.Code)
	}
}

func TestHandler_SemOrganizacao(t *testing.T) {
	h := newRouter(t, false)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodGet, "/closings?month=2026-10", nil).Code)
}

func TestHandler_FecharEReabrir(t *testing.T) {
	h := newRouter(t, true)

	rr := do(h, http.MethodPost, "/closings", map[string]string{"month": "2026-10"})
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())
	assert.Equal(t, "CLOSED", decode(t, rr).Data.Status)

	rr = do(h, http.MethodPost, "/closings", map[string]string{"month": "2026-10"})
	assert.Equal(t, http.StatusConflict, rr.Code)
	assert.Equal(t, "ALREADY_CLOSED", decode(t, rr).Error.Code)

	rr = do(h, http.MethodPost, "/closings/2026-10/reopen", map[string]string{"reason": ""})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "INVALID_REASON", decode(t, rr).Error.Code)

	rr = do(h, http.MethodPost, "/closings/2026-10/reopen", map[string]string{"reason": "corrigir baixa"})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	e := decode(t, rr)
	assert.Equal(t, "OPEN", e.Data.Status)
	assert.Len(t, e.Data.Events, 2)

	rr = do(h, http.MethodPost, "/closings/2026-10/reopen", map[string]string{"reason": "de novo"})
	assert.Equal(t, http.StatusConflict, rr.Code)
	assert.Equal(t, "NOT_CLOSED", decode(t, rr).Error.Code)
}

func TestHandler_Fechar_MesCorrente(t *testing.T) {
	h := newRouter(t, true)
	rr := do(h, http.MethodPost, "/closings", map[string]string{"month": "2026-11"})
	assert.Equal(t, http.StatusUnprocessableEntity, rr.Code)
	assert.Equal(t, "MONTH_NOT_ENDED", decode(t, rr).Error.Code)
}

func TestHandler_Fechar_CorpoInvalido(t *testing.T) {
	h := newRouter(t, true)
	req := httptest.NewRequest(http.MethodPost, "/closings", bytes.NewBufferString("{"))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

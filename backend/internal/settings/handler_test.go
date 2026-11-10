package settings_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/settings"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func router(t *testing.T, repo *mockRepo, withOrg bool) http.Handler {
	t.Helper()
	h := settings.NewHandler(settings.NewService(repo))
	r := chi.NewRouter()
	pass := func(next http.Handler) http.Handler { return next }
	h.Register(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if withOrg {
				req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), org, "owner"))
			}
			next.ServeHTTP(w, req)
		})
	}, pass, pass)
	return r
}

func do(h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if s, ok := body.(string); ok {
		buf.WriteString(s)
	} else if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(method, path, &buf))
	return rr
}

type env struct {
	Data  settings.FinancialRules `json:"data"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func decode(t *testing.T, rr *httptest.ResponseRecorder) env {
	t.Helper()
	var e env
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &e), rr.Body.String())
	return e
}

func TestHandler_Get_Padroes(t *testing.T) {
	rr := do(router(t, newMock(), true), http.MethodGet, "/settings/financial-rules", nil)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Equal(t, settings.DefaultFinancialRules(), decode(t, rr).Data)
}

func TestHandler_Put_GravaEDevolve(t *testing.T) {
	repo := newMock()
	h := router(t, repo, true)
	body := map[string]any{"late_fee_percent": 2.5, "monthly_interest_percent": 1, "default_adjustment_index": "IPCA", "readjust_notice_days": 45}
	rr := do(h, http.MethodPut, "/settings/financial-rules", body)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	want := settings.FinancialRules{LateFeePercent: 2.5, MonthlyInterestPercent: 1, DefaultAdjustmentIndex: "IPCA", ReadjustNoticeDays: 45}
	assert.Equal(t, want, decode(t, rr).Data)
	assert.Equal(t, want, decode(t, do(h, http.MethodGet, "/settings/financial-rules", nil)).Data)
}

func TestHandler_Put_ForaDaFaixa(t *testing.T) {
	repo := newMock()
	body := map[string]any{"late_fee_percent": 15, "monthly_interest_percent": 1, "default_adjustment_index": "IGP-M", "readjust_notice_days": 60}
	rr := do(router(t, repo, true), http.MethodPut, "/settings/financial-rules", body)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "INVALID_RULES", decode(t, rr).Error.Code)
	assert.Empty(t, repo.rows)
}

func TestHandler_Put_CorpoInvalido(t *testing.T) {
	rr := do(router(t, newMock(), true), http.MethodPut, "/settings/financial-rules", "{")
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "INVALID_BODY", decode(t, rr).Error.Code)
}

func TestHandler_SemOrganizacao(t *testing.T) {
	h := router(t, newMock(), false)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodGet, "/settings/financial-rules", nil).Code)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodPut, "/settings/financial-rules", map[string]any{}).Code)
}

package report_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/report"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func router(t *testing.T, repo *mockRepo, withOrg bool) http.Handler {
	t.Helper()
	h := report.NewHandler(svcAt(repo, 2026, time.November, 8))
	r := chi.NewRouter()
	pass := func(next http.Handler) http.Handler { return next }
	h.Register(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if withOrg {
				req = req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), uuid.New(), org, "admin"))
			}
			next.ServeHTTP(w, req)
		})
	}, pass)
	return r
}

func get(h http.Handler, path string) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
	return rr
}

func TestHandler_Overview(t *testing.T) {
	repo := &mockRepo{received: []report.MonthAmount{{Month: "2026-10", Total: 8300, Count: 5}}}
	rr := get(router(t, repo, true), "/reports/overview?year=2026")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var env struct {
		Data report.Overview `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &env))
	assert.Equal(t, 10, env.Data.ThroughMonth)
	assert.Equal(t, 8300.0, env.Data.Totals.Received)
	assert.Len(t, env.Data.Months, 10)
}

func TestHandler_ByProperty(t *testing.T) {
	id := uuid.New()
	repo := &mockRepo{unitRecv: []report.UnitAmount{{UnitID: id, Total: 1850}}}
	rr := get(router(t, repo, true), "/reports/by-property?year=2026")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var env struct {
		Data report.ByProperty `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &env))
	require.Len(t, env.Data.Rows, 1)
	assert.Equal(t, id, env.Data.Rows[0].UnitID)
}

func TestHandler_AnoInvalido(t *testing.T) {
	h := router(t, &mockRepo{}, true)
	for _, p := range []string{"/reports/overview", "/reports/overview?year=abc", "/reports/overview?year=2027", "/reports/by-property?year=1999"} {
		rr := get(h, p)
		assert.Equal(t, http.StatusBadRequest, rr.Code, p)
		assert.Contains(t, rr.Body.String(), "INVALID_YEAR", p)
	}
}

func TestHandler_SemOrganizacao(t *testing.T) {
	assert.Equal(t, http.StatusUnauthorized, get(router(t, &mockRepo{}, false), "/reports/overview?year=2026").Code)
}

func TestHandler_CarneLeao(t *testing.T) {
	rr := get(router(t, october(), true), "/reports/carne-leao?month=2026-10")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var env struct {
		Data report.CarneLeao `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &env))
	assert.Equal(t, 7200.0, env.Data.Base)
	assert.Equal(t, "2026-11-30", env.Data.DueDate)
	assert.Len(t, env.Data.Income.Lines, 5)
	assert.Len(t, env.Data.Deductions.Lines, 2)
}

func TestHandler_CarneLeao_Erros(t *testing.T) {
	h := router(t, &mockRepo{}, true)
	cases := map[string]struct {
		status int
		code   string
	}{
		"/reports/carne-leao":               {http.StatusBadRequest, "INVALID_MONTH"},
		"/reports/carne-leao?month=2026-13": {http.StatusBadRequest, "INVALID_MONTH"},
		"/reports/carne-leao?month=2026-11": {http.StatusUnprocessableEntity, "MONTH_NOT_ENDED"},
		"/reports/carne-leao?month=2027-02": {http.StatusUnprocessableEntity, "MONTH_NOT_ENDED"},
	}
	for path, want := range cases {
		rr := get(h, path)
		assert.Equal(t, want.status, rr.Code, path)
		assert.Contains(t, rr.Body.String(), want.code, path)
	}
}

func TestHandler_CarneLeao_SemOrganizacao(t *testing.T) {
	assert.Equal(t, http.StatusUnauthorized, get(router(t, &mockRepo{}, false), "/reports/carne-leao?month=2026-10").Code)
}

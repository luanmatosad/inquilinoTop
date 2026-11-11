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
				req = req.WithContext(auth.WithOwnerIDOrgID(req.Context(), uuid.New(), org))
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

// ---------- Pix ----------

type pixEnv struct {
	Data  json.RawMessage `json:"data"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func decodePix(t *testing.T, rr *httptest.ResponseRecorder) pixEnv {
	t.Helper()
	var e pixEnv
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &e), rr.Body.String())
	return e
}

func pixRouter(t *testing.T) (http.Handler, *mockRepo, uuid.UUID) {
	t.Helper()
	repo := newMock()
	unit := uuid.New()
	repo.unitOrg[unit] = org
	return router(t, repo, true), repo, unit
}

func TestHandler_Pix_GetVazio(t *testing.T) {
	h, _, _ := pixRouter(t)
	rr := do(h, http.MethodGet, "/settings/pix", nil)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var p settings.PixSettings
	require.NoError(t, json.Unmarshal(decodePix(t, rr).Data, &p))
	assert.False(t, p.Default.Configured)
	assert.NotNil(t, p.Units)
}

func TestHandler_Pix_PutNormalizaEGrava(t *testing.T) {
	h, _, _ := pixRouter(t)
	rr := do(h, http.MethodPut, "/settings/pix", map[string]any{"key_type": "CPF", "key": "529.982.247-25", "receiver_name": "Luan Matos", "city": "Manaus"})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var d settings.PixDefault
	require.NoError(t, json.Unmarshal(decodePix(t, rr).Data, &d))
	assert.Equal(t, "52998224725", d.Key)

	var p settings.PixSettings
	require.NoError(t, json.Unmarshal(decodePix(t, do(h, http.MethodGet, "/settings/pix", nil)).Data, &p))
	assert.True(t, p.Default.Configured)
}

func TestHandler_Pix_PutErros(t *testing.T) {
	h, repo, _ := pixRouter(t)
	cases := []struct {
		body   any
		status int
		code   string
	}{
		{map[string]any{"key_type": "CPF", "key": "123"}, http.StatusBadRequest, "INVALID_PIX_KEY"},
		{map[string]any{"key_type": "EMAIL", "key": "a@b.com", "receiver_name": "Nome muito mais longo que 25 letras"}, http.StatusBadRequest, "INVALID_PIX"},
		{"{", http.StatusBadRequest, "INVALID_BODY"},
	}
	for _, c := range cases {
		rr := do(h, http.MethodPut, "/settings/pix", c.body)
		assert.Equal(t, c.status, rr.Code)
		assert.Equal(t, c.code, decodePix(t, rr).Error.Code)
	}
	assert.Empty(t, repo.pixDefault)
}

func TestHandler_PixUnidade_ConfirmacaoObrigatoria(t *testing.T) {
	h, repo, unit := pixRouter(t)
	path := "/settings/pix/units/" + unit.String()
	rr := do(h, http.MethodPut, path, map[string]any{"key_type": "CNPJ", "key": "11.222.333/0001-81", "receiver_name": "Centro Ltda"})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "CONFIRMATION_REQUIRED", decodePix(t, rr).Error.Code)
	assert.Empty(t, repo.unitPix)

	rr = do(h, http.MethodPut, path, map[string]any{"key_type": "CNPJ", "key": "11.222.333/0001-81", "receiver_name": "Centro Ltda", "confirmed": true})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var u settings.UnitPix
	require.NoError(t, json.Unmarshal(decodePix(t, rr).Data, &u))
	assert.Equal(t, "11222333000181", u.Key)
	assert.Equal(t, unit, u.UnitID)
}

func TestHandler_PixUnidade_ErrosDeIdEUnidade(t *testing.T) {
	h, repo, _ := pixRouter(t)
	rr := do(h, http.MethodPut, "/settings/pix/units/nao-e-uuid", map[string]any{"confirmed": true})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "INVALID_ID", decodePix(t, rr).Error.Code)

	outra := uuid.New()
	repo.unitOrg[outra] = uuid.New() // de outra organização
	body := map[string]any{"key_type": "EMAIL", "key": "a@b.com", "confirmed": true}
	assert.Equal(t, http.StatusNotFound, do(h, http.MethodPut, "/settings/pix/units/"+outra.String(), body).Code)
	assert.Equal(t, http.StatusNotFound, do(h, http.MethodPut, "/settings/pix/units/"+uuid.NewString(), body).Code)

	rr = do(h, http.MethodPut, "/settings/pix/units/"+uuid.NewString(), map[string]any{"key_type": "CPF", "key": "x", "confirmed": true})
	assert.Equal(t, http.StatusBadRequest, rr.Code, "chave inválida vale antes de procurar a unidade")
}

func TestHandler_PixUnidade_Remover(t *testing.T) {
	h, _, unit := pixRouter(t)
	path := "/settings/pix/units/" + unit.String()
	assert.Equal(t, http.StatusNotFound, do(h, http.MethodDelete, path, nil).Code, "sem conta ativa")
	require.Equal(t, http.StatusOK, do(h, http.MethodPut, path, map[string]any{"key_type": "EMAIL", "key": "a@b.com", "confirmed": true}).Code)
	assert.Equal(t, http.StatusOK, do(h, http.MethodDelete, path, nil).Code)
	assert.Equal(t, http.StatusNotFound, do(h, http.MethodDelete, path, nil).Code)
}

func TestHandler_Pix_SemOrganizacao(t *testing.T) {
	h := router(t, newMock(), false)
	id := uuid.NewString()
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodGet, "/settings/pix", nil).Code)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodPut, "/settings/pix", map[string]any{}).Code)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodPut, "/settings/pix/units/"+id, map[string]any{}).Code)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodDelete, "/settings/pix/units/"+id, nil).Code)
}

// ---------- Lembretes ----------

type remindersEnv struct {
	Data struct {
		Reminders []settings.Reminder `json:"reminders"`
	} `json:"data"`
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func decodeReminders(t *testing.T, rr *httptest.ResponseRecorder) remindersEnv {
	t.Helper()
	var e remindersEnv
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &e), rr.Body.String())
	return e
}

func TestHandler_Reminders_GetPadroes(t *testing.T) {
	rr := do(router(t, newMock(), true), http.MethodGet, "/settings/reminders", nil)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Equal(t, settings.DefaultReminders(), decodeReminders(t, rr).Data.Reminders)
}

func TestHandler_Reminders_PutGravaEDevolveOrdenado(t *testing.T) {
	h := router(t, newMock(), true)
	body := map[string]any{"reminders": []map[string]any{
		{"name": "Atraso", "offset_days": 5, "body": "Atrasou {valor}"},
		{"name": "Antes", "offset_days": -2, "body": "Vence {vencimento}"},
	}}
	rr := do(h, http.MethodPut, "/settings/reminders", body)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	saved := decodeReminders(t, rr).Data.Reminders
	require.Len(t, saved, 2)
	assert.Equal(t, -2, saved[0].OffsetDays)
	assert.Equal(t, saved, decodeReminders(t, do(h, http.MethodGet, "/settings/reminders", nil)).Data.Reminders)
}

func TestHandler_Reminders_PutInvalidoTrazAMensagem(t *testing.T) {
	repo := newMock()
	h := router(t, repo, true)
	rr := do(h, http.MethodPut, "/settings/reminders", map[string]any{"reminders": []map[string]any{{"name": "X", "offset_days": 0, "body": "Oi {nom}!"}}})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	e := decodeReminders(t, rr)
	assert.Equal(t, "INVALID_REMINDERS", e.Error.Code)
	assert.Contains(t, e.Error.Message, "{nom}")
	assert.Empty(t, repo.reminders)

	rr = do(h, http.MethodPut, "/settings/reminders", map[string]any{"reminders": []map[string]any{}})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "INVALID_REMINDERS", decodeReminders(t, rr).Error.Code)

	assert.Equal(t, "INVALID_BODY", decodeReminders(t, do(h, http.MethodPut, "/settings/reminders", "{")).Error.Code)
}

func TestHandler_Reminders_SemOrganizacao(t *testing.T) {
	h := router(t, newMock(), false)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodGet, "/settings/reminders", nil).Code)
	assert.Equal(t, http.StatusUnauthorized, do(h, http.MethodPut, "/settings/reminders", map[string]any{}).Code)
}

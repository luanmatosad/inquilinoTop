package payment_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeLimiter libera as primeiras n chamadas e nega as seguintes.
type fakeLimiter struct{ left int }

func (f *fakeLimiter) Allow(string) bool {
	if f.left <= 0 {
		return false
	}
	f.left--
	return true
}

func publicRouter(e *publicEnv, ip, tok *fakeLimiter) http.Handler {
	h := payment.NewHandler(e.Service).WithPublicLimits(ip, tok)
	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), e.user, e.org, "admin")))
		})
	}, noopWriteMw, noopWriteMw)
	h.RegisterPublic(r)
	return r
}

func serve(h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func reportRequest(t *testing.T, token string, fields map[string]string, proof []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		require.NoError(t, mw.WriteField(k, v))
	}
	if proof != nil {
		hdr := textproto.MIMEHeader{}
		hdr.Set("Content-Disposition", `form-data; name="proof"; filename="comprovante.pdf"`)
		hdr.Set("Content-Type", "application/pdf")
		part, err := mw.CreatePart(hdr)
		require.NoError(t, err)
		_, _ = part.Write(proof)
	}
	require.NoError(t, mw.Close())
	req := httptest.NewRequest(http.MethodPost, "/public/payments/"+token+"/report", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return req
}

func errCode(t *testing.T, rr *httptest.ResponseRecorder) string {
	t.Helper()
	var env struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &env))
	return env.Error.Code
}

func TestHandler_Public_LeituraSemLoginENoStore(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	rr := serve(publicRouter(e, &fakeLimiter{left: 10}, &fakeLimiter{left: 10}), httptest.NewRequest(http.MethodGet, "/public/payments/"+token, nil))
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "no-store", rr.Header().Get("Cache-Control"))
	assert.Contains(t, rr.Body.String(), `"landlord_name":"Luan Matos"`)
	assert.Contains(t, rr.Body.String(), `"status":"PENDING"`)
}

func TestHandler_Public_TokenInválido404Genérico(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 10}, &fakeLimiter{left: 10})

	a := serve(h, httptest.NewRequest(http.MethodGet, "/public/payments/inexistente", nil))
	_ = e.newLink(t) // rotaciona: o primeiro token é revogado
	b := serve(h, httptest.NewRequest(http.MethodGet, "/public/payments/"+token, nil))
	require.Equal(t, http.StatusNotFound, a.Code)
	assert.Equal(t, a.Code, b.Code)
	assert.Equal(t, a.Body.String(), b.Body.String(), "token inexistente e revogado são indistinguíveis")
	assert.Equal(t, "NOT_FOUND", errCode(t, a))
}

func TestHandler_Public_RateLimitPorIP(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 1}, &fakeLimiter{left: 10})
	assert.Equal(t, http.StatusOK, serve(h, httptest.NewRequest(http.MethodGet, "/public/payments/"+token, nil)).Code)
	rr := serve(h, httptest.NewRequest(http.MethodGet, "/public/payments/"+token, nil))
	assert.Equal(t, http.StatusTooManyRequests, rr.Code)
	assert.Equal(t, "RATE_LIMIT_EXCEEDED", errCode(t, rr))
}

func TestHandler_Public_Pix(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	key := "luan@email.com"
	e.mockRepo.fc = &payment.FinancialConfig{PixKey: &key}
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 10}, &fakeLimiter{left: 10})
	rr := serve(h, httptest.NewRequest(http.MethodGet, "/public/payments/"+token+"/pix", nil))
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), "br.gov.bcb.pix")

	e.mockRepo.fc = nil
	rr = serve(h, httptest.NewRequest(http.MethodGet, "/public/payments/"+token+"/pix", nil))
	assert.Equal(t, http.StatusUnprocessableEntity, rr.Code)
	assert.Equal(t, "PIX_KEY_NOT_CONFIGURED", errCode(t, rr))
}

func TestHandler_Public_ReciboAntesDePaga409(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	rr := serve(publicRouter(e, &fakeLimiter{left: 10}, &fakeLimiter{left: 10}), httptest.NewRequest(http.MethodGet, "/public/payments/"+token+"/receipt", nil))
	assert.Equal(t, http.StatusConflict, rr.Code)
	assert.Equal(t, "NOT_PAID", errCode(t, rr))
}

func TestHandler_Public_Report_ComComprovante(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 10}, &fakeLimiter{left: 10})
	req := reportRequest(t, token, map[string]string{"amount": "1850,00", "paid_date": "2026-11-06"}, append([]byte("%PDF-1.4\n"), make([]byte, 100)...))
	rr := serve(h, req)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

	got, err := e.Get(req.Context(), e.p.ID, e.org)
	require.NoError(t, err)
	assert.True(t, got.AwaitingConfirmation)
	assert.True(t, got.HasProof)
}

func TestHandler_Public_Report_Erros(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 100}, &fakeLimiter{left: 100})

	cases := []struct {
		name   string
		fields map[string]string
		proof  []byte
		status int
		code   string
	}{
		{"data futura", map[string]string{"amount": "1850", "paid_date": "2026-11-09"}, nil, 400, "INVALID_PAID_DATE"},
		{"data malformada", map[string]string{"amount": "1850", "paid_date": "ontem"}, nil, 400, "INVALID_PAID_DATE"},
		{"valor zero", map[string]string{"amount": "0", "paid_date": "2026-11-06"}, nil, 400, "INVALID_REPORT"},
		{"valor ilegível", map[string]string{"amount": "abc", "paid_date": "2026-11-06"}, nil, 400, "INVALID_REPORT"},
		{"tipo falso", map[string]string{"amount": "1850", "paid_date": "2026-11-06"}, append([]byte("MZ"), make([]byte, 200)...), 415, "PROOF_TYPE_NOT_ALLOWED"},
		{"arquivo grande", map[string]string{"amount": "1850", "paid_date": "2026-11-06"}, append([]byte("%PDF-1.4\n"), make([]byte, payment.MaxProofBytes)...), 413, "PROOF_TOO_LARGE"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rr := serve(h, reportRequest(t, token, c.fields, c.proof))
			assert.Equal(t, c.status, rr.Code, rr.Body.String())
			assert.Equal(t, c.code, errCode(t, rr))
		})
	}
	got, err := e.Get(t.Context(), e.p.ID, e.org)
	require.NoError(t, err)
	assert.False(t, got.AwaitingConfirmation, "nenhum aviso inválido é gravado")
}

func TestHandler_Public_Report_LimitePorToken(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 100}, &fakeLimiter{left: 1})
	f := map[string]string{"amount": "1850", "paid_date": "2026-11-06"}
	assert.Equal(t, http.StatusOK, serve(h, reportRequest(t, token, f, nil)).Code)
	rr := serve(h, reportRequest(t, token, f, nil))
	assert.Equal(t, http.StatusTooManyRequests, rr.Code)
	assert.Equal(t, "RATE_LIMIT_EXCEEDED", errCode(t, rr))
}

func TestHandler_Dono_CriaLink(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	h := publicRouter(e, &fakeLimiter{left: 10}, &fakeLimiter{left: 10})
	rr := serve(h, httptest.NewRequest(http.MethodPost, "/payments/"+e.p.ID.String()+"/link", nil))
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), "https://app.imoviflow.test/p/")

	rr = serve(h, httptest.NewRequest(http.MethodPost, "/payments/"+uuid.NewString()+"/link", nil))
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestHandler_Dono_ConfirmaRecusaEBaixaComprovante(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 100}, &fakeLimiter{left: 100})
	base := "/payments/" + e.p.ID.String()

	assert.Equal(t, http.StatusConflict, serve(h, httptest.NewRequest(http.MethodPost, base+"/confirm-report", strings.NewReader("{}"))).Code)
	assert.Equal(t, http.StatusConflict, serve(h, httptest.NewRequest(http.MethodPost, base+"/reject-report", nil)).Code)
	assert.Equal(t, http.StatusNotFound, serve(h, httptest.NewRequest(http.MethodGet, base+"/proof", nil)).Code)

	png := append([]byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}, make([]byte, 64)...)
	require.Equal(t, 200, serve(h, reportRequest(t, token, map[string]string{"amount": "1850", "paid_date": "2026-11-06"}, png)).Code)

	rr := serve(h, httptest.NewRequest(http.MethodGet, base+"/proof", nil))
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "image/png", rr.Header().Get("Content-Type"), "o tipo vem do conteúdo, não do nome ou do Content-Type enviado")
}

func TestHandler_Dono_Confirma(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 100}, &fakeLimiter{left: 100})
	base := "/payments/" + e.p.ID.String()
	require.Equal(t, 200, serve(h, reportRequest(t, token, map[string]string{"amount": "1850", "paid_date": "2026-11-06"}, nil)).Code)

	rr := serve(h, httptest.NewRequest(http.MethodPost, base+"/confirm-report", strings.NewReader(`{"discount":0}`)))
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"status":"PAID"`)
	assert.Equal(t, http.StatusConflict, serve(h, httptest.NewRequest(http.MethodPost, base+"/reject-report", nil)).Code, "paga não aceita recusa")
}

func TestHandler_Dono_Recusa(t *testing.T) {
	e := newPublicEnv(t, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))
	token := e.newLink(t)
	h := publicRouter(e, &fakeLimiter{left: 100}, &fakeLimiter{left: 100})
	base := "/payments/" + e.p.ID.String()
	require.Equal(t, 200, serve(h, reportRequest(t, token, map[string]string{"amount": "1850", "paid_date": "2026-11-06"}, nil)).Code)
	rr := serve(h, httptest.NewRequest(http.MethodPost, base+"/reject-report", nil))
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	got, err := e.Get(t.Context(), e.p.ID, e.org)
	require.NoError(t, err)
	assert.False(t, got.AwaitingConfirmation)
}

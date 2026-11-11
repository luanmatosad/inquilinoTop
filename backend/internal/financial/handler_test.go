package financial

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func passthroughMW(next http.Handler) http.Handler { return next }

func newFinancialRouter(repo Repository) http.Handler {
	r := chi.NewRouter()
	NewHandler(NewService(repo)).Register(r, passthroughMW, passthroughMW, passthroughMW)
	return r
}

func withOrg(ctx context.Context, org uuid.UUID) context.Context {
	return auth.WithOwnerIDOrgID(ctx, uuid.New(), org)
}

func TestHandler_UpdateTransfer_TransicaoInvalidaRetorna409(t *testing.T) {
	repo := newMockRepo()
	id := seedTransfer(repo, StatusPending, 3000, 300, 0)
	router := newFinancialRouter(repo)

	body := bytes.NewBufferString(`{"status":"TRANSFERRED"}`)
	req := httptest.NewRequest(http.MethodPut, "/financial/transfers/"+id.String(), body).
		WithContext(withOrg(context.Background(), uuid.New()))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Contains(t, rec.Body.String(), "INVALID_TRANSITION")
}

func TestHandler_UpdateTransfer_SemOrganizacaoRetorna401(t *testing.T) {
	router := newFinancialRouter(newMockRepo())
	req := httptest.NewRequest(http.MethodPut, "/financial/transfers/"+uuid.New().String(), bytes.NewBufferString(`{}`))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "NO_ORG")
}

func TestHandler_GenerateTransfers_PeriodoInvalidoRetorna400(t *testing.T) {
	router := newFinancialRouter(newMockRepo())
	req := httptest.NewRequest(http.MethodPost, "/financial/transfers/generate",
		bytes.NewBufferString(`{"period":"05/2026"}`)).
		WithContext(withOrg(context.Background(), uuid.New()))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "INVALID_PERIOD")
}

func TestHandler_ImportBankRecords_CSVInvalidoRetorna400(t *testing.T) {
	router := newFinancialRouter(newMockRepo())

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, err := mw.CreateFormFile("file", "extrato.csv")
	require.NoError(t, err)
	_, _ = part.Write([]byte("data,valor\n2026-05-10,2500\n"))
	require.NoError(t, mw.Close())

	req := httptest.NewRequest(http.MethodPost, "/financial/bank-records/import", &buf).
		WithContext(withOrg(context.Background(), uuid.New()))
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "INVALID_CSV_FORMAT")
}

func TestHandler_ListCommissions_MVPRetornaListaVazia(t *testing.T) {
	router := newFinancialRouter(newMockRepo())
	req := httptest.NewRequest(http.MethodGet, "/financial/commissions", nil).
		WithContext(withOrg(context.Background(), uuid.New()))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Data []any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Empty(t, body.Data)
}

func TestHandler_AdminFee_PutDepoisGetDevolveTaxa(t *testing.T) {
	router := newFinancialRouter(newMockRepo())
	ctx := withOrg(context.Background(), uuid.New())

	put := httptest.NewRequest(http.MethodPut, "/financial/admin-fee", bytes.NewBufferString(`{"admin_fee_percent":12.5}`)).WithContext(ctx)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, put)
	require.Equal(t, http.StatusOK, rec.Code)

	get := httptest.NewRequest(http.MethodGet, "/financial/admin-fee", nil).WithContext(ctx)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, get)
	require.Equal(t, http.StatusOK, rec.Code)
	var body struct {
		Data struct {
			AdminFeePercent float64 `json:"admin_fee_percent"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, 12.5, body.Data.AdminFeePercent)
}

func TestHandler_AdminFee_ForaDaFaixaRetorna400(t *testing.T) {
	router := newFinancialRouter(newMockRepo())
	req := httptest.NewRequest(http.MethodPut, "/financial/admin-fee", bytes.NewBufferString(`{"admin_fee_percent":150}`)).
		WithContext(withOrg(context.Background(), uuid.New()))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "INVALID_ADMIN_FEE")
}

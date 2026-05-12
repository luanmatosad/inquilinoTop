package fiscal_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/fiscal"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMWWithOwnerID(ownerID uuid.UUID) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := auth.WithOwnerID(r.Context(), ownerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func TestHandler_AnnualReport_YearInválido(t *testing.T) {
	agg := &mockAggRepo{ownerName: "João"}
	h := fiscal.NewHandler(fiscal.NewService(agg))
	r := chi.NewRouter()
	h.Register(r, noopAuthMWWithOwnerID(uuid.New()))

	req := httptest.NewRequest("GET", "/fiscal/annual-report?year=xx", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_AnnualReport_YearObrigatório(t *testing.T) {
	agg := &mockAggRepo{ownerName: "João"}
	h := fiscal.NewHandler(fiscal.NewService(agg))
	r := chi.NewRouter()
	h.Register(r, noopAuthMWWithOwnerID(uuid.New()))

	req := httptest.NewRequest("GET", "/fiscal/annual-report", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_AnnualReport_YearForaDoRange(t *testing.T) {
	agg := &mockAggRepo{ownerName: "João"}
	h := fiscal.NewHandler(fiscal.NewService(agg))
	r := chi.NewRouter()
	h.Register(r, noopAuthMWWithOwnerID(uuid.New()))

	req := httptest.NewRequest("GET", "/fiscal/annual-report?year=1800", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_AnnualReport_SemAutenticação(t *testing.T) {
	agg := &mockAggRepo{ownerName: "João"}
	h := fiscal.NewHandler(fiscal.NewService(agg))
	r := chi.NewRouter()
	h.Register(r, noopAuthMWWithOwnerID(uuid.Nil))

	req := httptest.NewRequest("GET", "/fiscal/annual-report?year=2026", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestHandler_AnnualReport_Sucesso(t *testing.T) {
	ownerID := uuid.New()
	leaseID := uuid.New()
	unitID := uuid.New()

	docPF := "12345678901"

	agg := &mockAggRepo{
		ownerName: "João",
		leases: []fiscal.LeaseSummary{
			{
				LeaseID:          leaseID,
				TenantID:         uuid.New(),
				TenantName:       "Tenant PF",
				TenantDocument:   &docPF,
				TenantPersonType: "PF",
				UnitID:           unitID,
				UnitLabel:        func() *string { s := "Unit 1"; return &s }(),
			},
		},
		payments: []fiscal.PaidPayment{
			{PaymentID: uuid.New(), LeaseID: leaseID, Competency: "2026-01", GrossAmount: 1000, LateFeeAmount: 0, InterestAmount: 0, IRRFAmount: 0, NetAmount: 1000, Type: "RENT"},
		},
		taxes: []fiscal.TaxExpense{},
	}

	h := fiscal.NewHandler(fiscal.NewService(agg))
	r := chi.NewRouter()
	h.Register(r, noopAuthMWWithOwnerID(ownerID))

	req := httptest.NewRequest("GET", "/fiscal/annual-report?year=2026", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string]interface{}
	err := json.NewDecoder(w.Body).Decode(&body)
	require.NoError(t, err)

	data, ok := body["data"]
	require.True(t, ok, "expected data field")

	report, ok := data.(map[string]interface{})
	require.True(t, ok, "expected report object")

	assert.Equal(t, float64(2026), report["year"])
}
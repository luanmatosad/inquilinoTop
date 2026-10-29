package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/rbac"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func passthrough(next http.Handler) http.Handler { return next }

func newTestRouter(repo Repository) http.Handler {
	r := chi.NewRouter()
	NewHandler(NewService(repo, brt)).Register(r, passthrough, passthrough)
	return r
}

func doGet(h http.Handler, ctx context.Context) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/dashboard/metrics", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHandler_Metrics_OK(t *testing.T) {
	org := uuid.New()
	repo := &mockRepo{metrics: &Metrics{TotalProperties: 3, TotalUnits: 10, OccupiedUnits: 7, VacancyRate: 30}}
	ctx := auth.WithOwnerIDOrgID(context.Background(), uuid.New(), org)

	rec := doGet(newTestRouter(repo), ctx)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, org, repo.gotOrg)
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.EqualValues(t, 3, body.Data["total_properties"])
	assert.EqualValues(t, 30, body.Data["vacancy_rate"])
	assert.Equal(t, []any{}, body.Data["recent_payments"])
	assert.Equal(t, []any{}, body.Data["expiring_leases"])
	assert.Contains(t, body.Data, "monthly_revenue")
	assert.Contains(t, body.Data, "total_tenants")
}

func TestHandler_Metrics_SemOrganizacao(t *testing.T) {
	rec := doGet(newTestRouter(&mockRepo{metrics: &Metrics{}}), context.Background())

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "NO_ORG")
}

func TestHandler_Metrics_ErroInterno(t *testing.T) {
	ctx := auth.WithOwnerIDOrgID(context.Background(), uuid.New(), uuid.New())

	rec := doGet(newTestRouter(&mockRepo{err: errors.New("db down")}), ctx)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "METRICS_FAILED")
	assert.Contains(t, rec.Body.String(), "erro ao calcular métricas")
	assert.NotContains(t, rec.Body.String(), "db down")
}

func TestHandler_Metrics_RBAC_PapelSemPaymentRead(t *testing.T) {
	r := chi.NewRouter()
	NewHandler(NewService(&mockRepo{metrics: &Metrics{}}, brt)).
		Register(r, passthrough, rbac.PermissionMiddleware(rbac.PermissionPaymentRead))

	for role, want := range map[string]int{
		"viewer":   http.StatusForbidden,
		"employee": http.StatusOK,
		"owner":    http.StatusOK,
	} {
		ctx := auth.WithOwnerIDOrgIDRole(context.Background(), uuid.New(), uuid.New(), role)
		rec := doGet(r, ctx)
		assert.Equal(t, want, rec.Code, "role %s", role)
		if want == http.StatusForbidden {
			assert.Contains(t, rec.Body.String(), "FORBIDDEN")
		}
	}
}

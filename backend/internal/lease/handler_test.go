package lease_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func noopWriteMw(next http.Handler) http.Handler {
	return next
}

func authMWWithOwnerID(ownerID uuid.UUID) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := auth.WithOwnerIDOrgID(r.Context(), ownerID, ownerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type mockLeaseRepo struct {
	leases map[uuid.UUID]*lease.Lease
}

func newMockLeaseRepo() *mockLeaseRepo {
	return &mockLeaseRepo{leases: make(map[uuid.UUID]*lease.Lease)}
}

func (m *mockLeaseRepo) Create(_ context.Context, orgID uuid.UUID, in lease.CreateLeaseInput) (*lease.Lease, error) {
	l := &lease.Lease{
		ID: uuid.New(), OrganizationID: orgID, UnitID: in.UnitID,
		TenantID: in.TenantID, StartDate: in.StartDate, EndDate: in.EndDate, Notes: in.Notes,
		RentAmount: in.RentAmount, PaymentDay: in.PaymentDay, Status: "ACTIVE", IsActive: true,
		AdjustmentIndex: in.AdjustmentIndex, AdjustmentMonth: in.AdjustmentMonth,
	}
	m.leases[l.ID] = l
	return l, nil
}

// HasOverlap reproduz a regra do banco: contratos ACTIVE da unidade com período intersectando [start, end].
func (m *mockLeaseRepo) HasOverlap(_ context.Context, unitID, orgID uuid.UUID, start time.Time, end *time.Time, exceptID uuid.UUID) (bool, error) {
	for _, l := range m.leases {
		if l.ID == exceptID || l.UnitID != unitID || l.OrganizationID != orgID || l.Status != "ACTIVE" || !l.IsActive {
			continue
		}
		// [l.Start, l.End] ∩ [start, end] != ∅, com fim nulo = aberto
		endsBeforeStart := l.EndDate != nil && l.EndDate.Before(start)
		startsAfterEnd := end != nil && l.StartDate.After(*end)
		if !endsBeforeStart && !startsAfterEnd {
			return true, nil
		}
	}
	return false, nil
}

func (m *mockLeaseRepo) GetByID(_ context.Context, id, orgID uuid.UUID) (*lease.Lease, error) {
	l, ok := m.leases[id]
	if !ok || l.OrganizationID != orgID {
		return nil, errors.New("not found")
	}
	return l, nil
}

func (m *mockLeaseRepo) List(_ context.Context, orgID uuid.UUID) ([]lease.Lease, error) {
	var list []lease.Lease
	for _, l := range m.leases {
		if l.OrganizationID == orgID && l.IsActive {
			list = append(list, *l)
		}
	}
	return list, nil
}

func (m *mockLeaseRepo) Update(_ context.Context, id, orgID uuid.UUID, in lease.UpdateLeaseInput) (*lease.Lease, error) {
	l, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	l.Status = in.Status
	l.RentAmount = in.RentAmount
	l.AdjustmentIndex = in.AdjustmentIndex
	l.AdjustmentMonth = in.AdjustmentMonth
	return l, nil
}

func (m *mockLeaseRepo) Delete(_ context.Context, id, orgID uuid.UUID) error {
	l, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return err
	}
	l.IsActive = false
	return nil
}

func (m *mockLeaseRepo) End(_ context.Context, id, orgID uuid.UUID, endDate time.Time, reason *string) (*lease.Lease, error) {
	l, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	l.Status = "ENDED"
	// Mesma regra do SQL: a saída nunca estende o prazo (LEAST).
	if l.EndDate == nil || endDate.Before(*l.EndDate) {
		e := endDate
		l.EndDate = &e
	}
	l.EndReason = reason
	return l, nil
}

func (m *mockLeaseRepo) Renew(_ context.Context, id, orgID uuid.UUID, in lease.RenewLeaseInput) (*lease.Lease, error) {
	l, err := m.GetByID(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	l.Status = "ACTIVE"
	l.EndDate = &in.NewEndDate
	if in.RentAmount > 0 {
		l.RentAmount = in.RentAmount
	}
	return l, nil
}

func (m *mockLeaseRepo) UpdateRentAmount(_ context.Context, id, orgID uuid.UUID, amount float64) (*lease.Lease, error) {
	l, ok := m.leases[id]
	if !ok || l.OrganizationID != orgID {
		return nil, errors.New("not found")
	}
	l.RentAmount = amount
	return l, nil
}

type mockReadjustmentRepo struct {
	items []lease.Readjustment
}

func newMockReadjustmentRepo() *mockReadjustmentRepo {
	return &mockReadjustmentRepo{}
}

func (m *mockReadjustmentRepo) Create(_ context.Context, in *lease.Readjustment) (*lease.Readjustment, error) {
	in.ID = uuid.New()
	in.CreatedAt = time.Now()
	m.items = append(m.items, *in)
	out := *in
	return &out, nil
}

func (m *mockReadjustmentRepo) ListByLease(_ context.Context, leaseID, orgID uuid.UUID) ([]lease.Readjustment, error) {
	var out []lease.Readjustment
	for _, r := range m.items {
		if r.LeaseID == leaseID && r.OrganizationID == orgID {
			out = append(out, r)
		}
	}
	return out, nil
}

func seedLease(t *testing.T, mock *mockLeaseRepo) *lease.Lease {
	t.Helper()
	l, err := mock.Create(context.Background(), uuid.Nil, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(),
		StartDate: time.Now(), RentAmount: 1000,
	})
	require.NoError(t, err)
	return l
}

func TestHandler_Create_BodyInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	req := httptest.NewRequest(http.MethodPost, "/leases", strings.NewReader("not-json"))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Create_Válido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	body, _ := json.Marshal(lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1500,
		PaymentDay: 5,
	})
	req := httptest.NewRequest(http.MethodPost, "/leases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestHandler_Get_IDInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	req := httptest.NewRequest(http.MethodGet, "/leases/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Update_IDInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	req := httptest.NewRequest(http.MethodPut, "/leases/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	req := httptest.NewRequest(http.MethodDelete, "/leases/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_EndLease_RouteExists(t *testing.T) {
	mock := newMockLeaseRepo()
	orgID := uuid.New()
	l, err := mock.Create(context.Background(), orgID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	require.NoError(t, err)
	svc := lease.NewService(mock, newMockReadjustmentRepo())
	h := lease.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(orgID), noopWriteMw, noopWriteMw)

	req := httptest.NewRequest("POST", "/leases/"+l.ID.String()+"/end", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_RenewLease_RouteExists(t *testing.T) {
	mock := newMockLeaseRepo()
	orgID := uuid.New()
	l, err := mock.Create(context.Background(), orgID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	require.NoError(t, err)
	svc := lease.NewService(mock, newMockReadjustmentRepo())
	h := lease.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(orgID), noopWriteMw, noopWriteMw)

	body, _ := json.Marshal(map[string]interface{}{
		"new_end_date": time.Now().Add(365 * 24 * time.Hour),
		"rent_amount":  1200.0,
	})
	req := httptest.NewRequest("POST", "/leases/"+l.ID.String()+"/renew", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Readjust_RouteExists(t *testing.T) {
	mock := newMockLeaseRepo()
	orgID := uuid.New()
	l, err := mock.Create(context.Background(), orgID, lease.CreateLeaseInput{
		UnitID:     uuid.New(),
		TenantID:   uuid.New(),
		StartDate:  time.Now(),
		RentAmount: 1000,
	})
	require.NoError(t, err)
	svc := lease.NewService(mock, newMockReadjustmentRepo())
	h := lease.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(orgID), noopWriteMw, noopWriteMw)

	body, _ := json.Marshal(map[string]interface{}{
		"percentage": 0.0523,
		"applied_at": time.Now(),
		"index_name": "IGPM",
	})
	req := httptest.NewRequest("POST", "/leases/"+l.ID.String()+"/readjust", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_Readjust_PercentagemInválida(t *testing.T) {
	leaseMock := newMockLeaseRepo()
	readjMock := newMockReadjustmentRepo()
	orgID, leaseID := uuid.New(), uuid.New()
	leaseMock.leases[leaseID] = &lease.Lease{ID: leaseID, OrganizationID: orgID, Status: "ACTIVE", RentAmount: 2000, IsActive: true}
	svc := lease.NewService(leaseMock, readjMock)
	h := lease.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)

	body := `{"percentage":0.0,"applied_at":"2026-04-01T00:00:00Z"}`
	req := httptest.NewRequest("POST", "/leases/"+leaseID.String()+"/readjust", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Contains(t, rr.Body.String(), "INVALID_PERCENTAGE")
}

func postLease(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, authMWWithOwnerID(uuid.New()), noopWriteMw, noopWriteMw)
	req := httptest.NewRequest(http.MethodPost, "/leases", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func leaseBody(extra string) string {
	return `{"unit_id":"` + uuid.New().String() + `","tenant_id":"` + uuid.New().String() +
		`","start_date":"2025-03-10T00:00:00Z","rent_amount":1850,"payment_day":5` + extra + `}`
}

func TestHandler_Create_IndiceEMesDeReajuste(t *testing.T) {
	rr := postLease(t, leaseBody(`,"adjustment_index":"IGP-M","adjustment_month":3`))
	require.Equal(t, http.StatusCreated, rr.Code)
	var resp struct {
		Data struct {
			AdjustmentIndex    string  `json:"adjustment_index"`
			AdjustmentMonth    int     `json:"adjustment_month"`
			NextReadjustment   *string `json:"next_readjustment"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	assert.Equal(t, "IGP-M", resp.Data.AdjustmentIndex)
	assert.Equal(t, 3, resp.Data.AdjustmentMonth)
	require.NotNil(t, resp.Data.NextReadjustment)
	assert.Contains(t, *resp.Data.NextReadjustment, "2026-03-01")
}

func TestHandler_Create_MesDeReajusteInválido(t *testing.T) {
	for _, extra := range []string{`,"adjustment_month":13`, `,"adjustment_month":0`, `,"adjustment_index":"XYZ"`} {
		rr := postLease(t, leaseBody(extra))
		assert.Equal(t, http.StatusBadRequest, rr.Code, extra)
	}
}

func newEndHandler(t *testing.T) (*chi.Mux, *lease.Service, uuid.UUID) {
	t.Helper()
	svc := lease.NewService(newMockLeaseRepo(), newMockReadjustmentRepo())
	h := lease.NewHandler(svc)
	r := chi.NewRouter()
	owner := uuid.New() // authMWWithOwnerID usa o mesmo id como organização
	h.Register(r, authMWWithOwnerID(owner), noopWriteMw, noopWriteMw)
	return r, svc, owner
}

func postEnd(t *testing.T, r *chi.Mux, id uuid.UUID, body string) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *strings.Reader
	if body == "" {
		rdr = strings.NewReader("")
	} else {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(http.MethodPost, "/leases/"+id.String()+"/end", rdr)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func TestHandler_End_SemCorpoContinuaFuncionando(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Now().AddDate(-1, 0, 0), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, "")
	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_End_ComDataEMotivo(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, `{"end_date":"2026-11-30","reason":"TERM_END"}`)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	var resp struct {
		Data struct {
			Status    string `json:"status"`
			EndDate   string `json:"end_date"`
			EndReason string `json:"end_reason"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
	assert.Equal(t, "ENDED", resp.Data.Status)
	assert.Contains(t, resp.Data.EndDate, "2026-11-30")
	assert.Equal(t, "TERM_END", resp.Data.EndReason)
}

func TestHandler_End_MotivoInválido(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, `{"reason":"PORQUE_SIM"}`)
	assert.Equal(t, http.StatusBadRequest, rr.Code)

	got, err := svc.Get(context.Background(), created.Lease.ID, owner)
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", got.Status, "contrato não pode ser encerrado com motivo inválido")
}

func TestHandler_End_DataAntesDoInício(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, `{"end_date":"2025-03-09"}`)
	assert.Equal(t, http.StatusUnprocessableEntity, rr.Code)
}

func TestHandler_End_CorpoInválido(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, `{not json`)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_End_DataEmRFC3339(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, `{"end_date":"2026-11-30T00:00:00Z"}`)
	assert.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
}

func TestHandler_End_DataMalformada(t *testing.T) {
	r, svc, owner := newEndHandler(t)
	created, err := svc.Create(context.Background(), owner, owner, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(), StartDate: time.Date(2025, 3, 10, 0, 0, 0, 0, time.UTC), RentAmount: 1500, PaymentDay: 5,
	})
	require.NoError(t, err)

	rr := postEnd(t, r, created.Lease.ID, `{"end_date":"30/11/2026"}`)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

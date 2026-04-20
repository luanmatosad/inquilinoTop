package lease_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

type mockLeaseRepo struct {
	leases map[uuid.UUID]*lease.Lease
}

func newMockLeaseRepo() *mockLeaseRepo {
	return &mockLeaseRepo{leases: make(map[uuid.UUID]*lease.Lease)}
}

func (m *mockLeaseRepo) Create(_ context.Context, ownerID uuid.UUID, in lease.CreateLeaseInput) (*lease.Lease, error) {
	l := &lease.Lease{
		ID: uuid.New(), OwnerID: ownerID, UnitID: in.UnitID,
		TenantID: in.TenantID, StartDate: in.StartDate,
		RentAmount: in.RentAmount, Status: "ACTIVE", IsActive: true,
	}
	m.leases[l.ID] = l
	return l, nil
}

func (m *mockLeaseRepo) GetByID(_ context.Context, id, ownerID uuid.UUID) (*lease.Lease, error) {
	l, ok := m.leases[id]
	if !ok || l.OwnerID != ownerID {
		return nil, errors.New("not found")
	}
	return l, nil
}

func (m *mockLeaseRepo) List(_ context.Context, ownerID uuid.UUID) ([]lease.Lease, error) {
	var list []lease.Lease
	for _, l := range m.leases {
		if l.OwnerID == ownerID && l.IsActive {
			list = append(list, *l)
		}
	}
	return list, nil
}

func (m *mockLeaseRepo) Update(_ context.Context, id, ownerID uuid.UUID, in lease.UpdateLeaseInput) (*lease.Lease, error) {
	l, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	l.Status = in.Status
	l.RentAmount = in.RentAmount
	return l, nil
}

func (m *mockLeaseRepo) Delete(_ context.Context, id, ownerID uuid.UUID) error {
	l, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return err
	}
	l.IsActive = false
	return nil
}

func (m *mockLeaseRepo) End(_ context.Context, id, ownerID uuid.UUID) (*lease.Lease, error) {
	l, err := m.GetByID(context.Background(), id, ownerID)
	if err != nil {
		return nil, err
	}
	l.Status = "ENDED"
	now := time.Now()
	l.EndDate = &now
	return l, nil
}

func (m *mockLeaseRepo) Renew(_ context.Context, id, ownerID uuid.UUID, in lease.RenewLeaseInput) (*lease.Lease, error) {
	l, err := m.GetByID(context.Background(), id, ownerID)
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

func seedLease(t *testing.T, mock *mockLeaseRepo) *lease.Lease {
	t.Helper()
	l, err := mock.Create(context.Background(), uuid.Nil, lease.CreateLeaseInput{
		UnitID: uuid.New(), TenantID: uuid.New(),
		StartDate: time.Now(), RentAmount: 1000,
	})
	require.NoError(t, err)
	return l
}

func TestHandler_EndLease_RouteExists(t *testing.T) {
	mock := newMockLeaseRepo()
	l := seedLease(t, mock)
	svc := lease.NewService(mock)
	h := lease.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	req := httptest.NewRequest("POST", "/api/v1/leases/"+l.ID.String()+"/end", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHandler_RenewLease_RouteExists(t *testing.T) {
	mock := newMockLeaseRepo()
	l := seedLease(t, mock)
	svc := lease.NewService(mock)
	h := lease.NewHandler(svc)

	r := chi.NewRouter()
	h.Register(r, noopAuthMW)

	body, _ := json.Marshal(map[string]interface{}{
		"new_end_date": time.Now().Add(365 * 24 * time.Hour),
		"rent_amount":  1200.0,
	})
	req := httptest.NewRequest("POST", "/api/v1/leases/"+l.ID.String()+"/renew", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

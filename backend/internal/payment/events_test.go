package payment_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/payment"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockEventStore guarda os eventos em memória, isolados por organização.
type mockEventStore struct {
	events []payment.Event
	orgs   map[uuid.UUID]uuid.UUID // eventID -> orgID
}

func newMockEventStore() *mockEventStore {
	return &mockEventStore{orgs: map[uuid.UUID]uuid.UUID{}}
}

func (m *mockEventStore) AddEvent(_ context.Context, orgID, paymentID uuid.UUID, actor *uuid.UUID, kind string, channel *string, data map[string]any) (*payment.Event, error) {
	e := payment.Event{ID: uuid.New(), PaymentID: paymentID, Kind: kind, Channel: channel, Data: data, ActorID: actor, OccurredAt: time.Date(2026, 10, 30, 0, 0, len(m.events), 0, time.UTC)}
	m.events = append(m.events, e)
	m.orgs[e.ID] = orgID
	return &e, nil
}

func (m *mockEventStore) ListEvents(_ context.Context, paymentID, orgID uuid.UUID) ([]payment.Event, error) {
	var out []payment.Event
	for _, e := range m.events {
		if e.PaymentID == paymentID && m.orgs[e.ID] == orgID {
			out = append(out, e)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].OccurredAt.Before(out[j].OccurredAt) })
	return out, nil
}

func newEventsService(t *testing.T, now time.Time) (*testService, *mockEventStore) {
	t.Helper()
	ts := newTestService()
	store := newMockEventStore()
	ts.Service.WithEvents(store).WithClock(func() time.Time { return now })
	return ts, store
}

func seedPayment(t *testing.T, ts *testService, orgID uuid.UUID, due time.Time) *payment.Payment {
	t.Helper()
	p, err := ts.Create(context.Background(), uuid.New(), orgID, payment.CreatePaymentInput{
		LeaseID: uuid.New(), DueDate: due, GrossAmount: 1550, Type: "RENT",
	})
	require.NoError(t, err)
	return p
}

var nov7 = time.Date(2026, 11, 7, 12, 0, 0, 0, time.UTC)

func TestService_Timeline_CobrançaRecémCriada(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	org := uuid.New()
	p := seedPayment(t, ts, org, time.Date(2026, 11, 20, 0, 0, 0, 0, time.UTC))

	items, err := ts.Timeline(context.Background(), p.ID, org)
	require.NoError(t, err)
	require.Len(t, items, 1)
	assert.Equal(t, payment.TimelineCreated, items[0].Kind)
}

func TestService_Timeline_AtrasadaComEnvioELembrete(t *testing.T) {
	ts, store := newEventsService(t, nov7)
	org := uuid.New()
	user := uuid.New()
	p := seedPayment(t, ts, org, time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC))

	_, err := ts.RecordEvent(context.Background(), p.ID, org, user, payment.RecordEventInput{Kind: "SENT", Channel: "WHATSAPP"})
	require.NoError(t, err)
	_, err = ts.RecordEvent(context.Background(), p.ID, org, user, payment.RecordEventInput{Kind: "REMINDER", Channel: "WHATSAPP"})
	require.NoError(t, err)
	assert.Len(t, store.events, 2)

	items, err := ts.Timeline(context.Background(), p.ID, org)
	require.NoError(t, err)
	kinds := []string{}
	for _, it := range items {
		kinds = append(kinds, it.Kind)
	}
	assert.Contains(t, kinds, payment.TimelineCreated)
	assert.Contains(t, kinds, payment.TimelineOverdue)
	assert.Contains(t, kinds, "SENT")
	assert.Contains(t, kinds, "REMINDER")
	for i := 1; i < len(items); i++ {
		assert.False(t, items[i].At.Before(items[i-1].At), "ordem cronológica")
	}
	for _, it := range items {
		if it.Kind == payment.TimelineOverdue {
			assert.Equal(t, time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC), it.At)
		}
	}
}

func TestService_Timeline_PagaNaoTemVenceuEm(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	org := uuid.New()
	p := seedPayment(t, ts, org, time.Date(2026, 10, 25, 0, 0, 0, 0, time.UTC))
	ts.mockRepo.payments[p.ID].Status = "PAID"

	items, err := ts.Timeline(context.Background(), p.ID, org)
	require.NoError(t, err)
	for _, it := range items {
		assert.NotEqual(t, payment.TimelineOverdue, it.Kind)
	}
}

func TestService_Timeline_OutraOrganização(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	p := seedPayment(t, ts, uuid.New(), nov7)
	_, err := ts.Timeline(context.Background(), p.ID, uuid.New())
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

func TestService_RecordEvent_Inválidos(t *testing.T) {
	ts, store := newEventsService(t, nov7)
	org, user := uuid.New(), uuid.New()
	p := seedPayment(t, ts, org, nov7)

	for _, in := range []payment.RecordEventInput{
		{Kind: "PAID", Channel: "WHATSAPP"},
		{Kind: "AGREEMENT", Channel: "COPY"},
		{Kind: "SENT", Channel: "SMS"},
		{Kind: "", Channel: ""},
	} {
		_, err := ts.RecordEvent(context.Background(), p.ID, org, user, in)
		assert.ErrorIs(t, err, payment.ErrInvalidEvent, "%+v", in)
	}
	assert.Empty(t, store.events)
}

func TestService_RecordEvent_CobrançaPaga(t *testing.T) {
	ts, store := newEventsService(t, nov7)
	org := uuid.New()
	p := seedPayment(t, ts, org, nov7)
	ts.mockRepo.payments[p.ID].Status = "PAID"

	_, err := ts.RecordEvent(context.Background(), p.ID, org, uuid.New(), payment.RecordEventInput{Kind: "SENT", Channel: "EMAIL"})
	assert.True(t, ts.IsAlreadyPaid(err))
	assert.Empty(t, store.events)
}

func eventsRouter(ts *testService, org, user uuid.UUID) http.Handler {
	h := payment.NewHandler(ts.Service)
	r := chi.NewRouter()
	h.Register(r, func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := auth.WithOwnerIDOrgID(req.Context(), user, org)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	}, noopWriteMw, noopWriteMw)
	return r
}

func TestHandler_Events_ListaEGrava(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	org, user := uuid.New(), uuid.New()
	p := seedPayment(t, ts, org, nov7)
	r := eventsRouter(ts, org, user)

	body, _ := json.Marshal(map[string]string{"kind": "SENT", "channel": "WHATSAPP"})
	req := httptest.NewRequest(http.MethodPost, "/payments/"+p.ID.String()+"/events", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusCreated, rr.Code)

	req = httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/events", nil)
	rr = httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"kind":"SENT"`)
	assert.Contains(t, rr.Body.String(), `"kind":"CREATED"`)
}

func TestHandler_Events_KindInválido_400(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	org := uuid.New()
	p := seedPayment(t, ts, org, nov7)
	r := eventsRouter(ts, org, uuid.New())

	body, _ := json.Marshal(map[string]string{"kind": "PAID", "channel": "COPY"})
	req := httptest.NewRequest(http.MethodPost, "/payments/"+p.ID.String()+"/events", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Events_CobrançaPaga_409(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	org := uuid.New()
	p := seedPayment(t, ts, org, nov7)
	ts.mockRepo.payments[p.ID].Status = "PAID"
	r := eventsRouter(ts, org, uuid.New())

	body, _ := json.Marshal(map[string]string{"kind": "SENT", "channel": "COPY"})
	req := httptest.NewRequest(http.MethodPost, "/payments/"+p.ID.String()+"/events", bytes.NewReader(body))
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusConflict, rr.Code)
}

func TestHandler_Events_OutraOrganização_404(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	p := seedPayment(t, ts, uuid.New(), nov7)
	r := eventsRouter(ts, uuid.New(), uuid.New())

	req := httptest.NewRequest(http.MethodGet, "/payments/"+p.ID.String()+"/events", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestHandler_Events_NaoExisteEditarNemExcluir(t *testing.T) {
	ts, _ := newEventsService(t, nov7)
	org := uuid.New()
	p := seedPayment(t, ts, org, nov7)
	r := eventsRouter(ts, org, uuid.New())
	for _, m := range []string{http.MethodPut, http.MethodDelete, http.MethodPatch} {
		req := httptest.NewRequest(m, "/payments/"+p.ID.String()+"/events/"+uuid.NewString(), nil)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)
		assert.GreaterOrEqual(t, rr.Code, 404, m)
	}
}

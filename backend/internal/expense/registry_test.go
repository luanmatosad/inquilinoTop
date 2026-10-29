package expense_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/expense"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var fixedNow = time.Date(2026, 6, 15, 14, 0, 0, 0, time.UTC)

type fakeAuditor struct{ events []string }

func (f *fakeAuditor) LogUpdate(_ context.Context, _ uuid.UUID, entityType string, _ uuid.UUID, _ uuid.UUID, _ string) {
	f.events = append(f.events, entityType)
}

type regEnv struct {
	svc     *expense.Service
	repo    *mockExpenseRepo
	auditor *fakeAuditor
	org     uuid.UUID
	unit    uuid.UUID
}

func newRegEnv() *regEnv {
	e := &regEnv{repo: newMockExpenseRepo(), auditor: &fakeAuditor{}, org: testOrg, unit: uuid.New()}
	e.svc = expense.NewService(e.repo).WithAuditor(e.auditor).WithClock(func() time.Time { return fixedNow })
	return e
}

func (e *regEnv) add(t *testing.T, amount float64, due time.Time) *expense.Expense {
	t.Helper()
	x, err := e.svc.Create(context.Background(), uuid.New(), e.org, expense.CreateExpenseInput{
		UnitID: e.unit, Description: "Conta", Amount: amount, DueDate: due, Category: "WATER",
	})
	require.NoError(t, err)
	return x
}

func d(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, time.UTC) }

// ---- status derivado ----

func TestService_NovaDespesaNasceVencidaOuPendente(t *testing.T) {
	e := newRegEnv()
	assert.Equal(t, expense.StatusPending, e.add(t, 10, d(2026, 6, 15)).Status, "vence hoje: ainda a vencer")
	assert.Equal(t, expense.StatusLate, e.add(t, 10, d(2026, 6, 14)).Status, "venceu ontem")
	assert.Equal(t, expense.StatusPending, e.add(t, 10, d(2026, 7, 1)).Status)
}

func TestService_Get_DerivaLate(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 10, d(2026, 5, 1))
	got, err := e.svc.Get(context.Background(), x.ID, e.org)
	require.NoError(t, err)
	assert.Equal(t, expense.StatusLate, got.Status)
	assert.Equal(t, expense.StatusPending, e.repo.expenses[x.ID].Status, "LATE não é gravado")
}

func TestService_List_StatusInválido(t *testing.T) {
	e := newRegEnv()
	_, err := e.svc.List(context.Background(), e.org, expense.ListFilter{Status: "XYZ"})
	assert.ErrorIs(t, err, expense.ErrInvalidFilter)
}

func TestService_List_FiltroLateTrazSóPendentesVencidas(t *testing.T) {
	e := newRegEnv()
	venc := e.add(t, 10, d(2026, 6, 1))
	e.add(t, 10, d(2026, 7, 1))
	paga := e.add(t, 10, d(2026, 5, 1))
	_, err := e.svc.Pay(context.Background(), paga.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 5, 2)})
	require.NoError(t, err)

	list, err := e.svc.List(context.Background(), e.org, expense.ListFilter{Status: expense.StatusLate})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, venc.ID, list[0].ID)
	assert.Equal(t, expense.StatusLate, list[0].Status)
}

func TestService_List_Período(t *testing.T) {
	e := newRegEnv()
	e.add(t, 1, d(2026, 6, 1))
	dentro := e.add(t, 2, d(2026, 6, 10))
	e.add(t, 3, d(2026, 7, 1))
	from, to := d(2026, 6, 5), d(2026, 6, 30)

	list, err := e.svc.List(context.Background(), e.org, expense.ListFilter{From: &from, To: &to})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, dentro.ID, list[0].ID)
}

func TestService_List_VaziaNaoÉNil(t *testing.T) {
	e := newRegEnv()
	list, err := e.svc.List(context.Background(), e.org, expense.ListFilter{Status: expense.StatusPaid})
	require.NoError(t, err)
	assert.Empty(t, list)
}

// ---- baixa ----

func TestService_Pay_ValorPadrãoÉOValorDaDespesa(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	paid, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	require.NoError(t, err)
	assert.Equal(t, expense.StatusPaid, paid.Status)
	assert.Equal(t, 150.0, *paid.PaidAmount)
	assert.True(t, paid.PaidDate.Equal(d(2026, 6, 15)))
}

func TestService_Pay_ValorDiferenteArredondado(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	v := 149.9949
	paid, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15), PaidAmount: &v})
	require.NoError(t, err)
	assert.Equal(t, 149.99, *paid.PaidAmount)
}

func TestService_Pay_ValorZeroOuNegativo(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	for _, v := range []float64{0.001, -5} {
		v := v
		_, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15), PaidAmount: &v})
		assert.Error(t, err, "valor %v", v)
	}
}

func TestService_Pay_BaixaRepetida(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	in := expense.PayExpenseInput{PaidDate: d(2026, 6, 15)}
	_, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), in)
	require.NoError(t, err)

	_, err = e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), in)
	assert.ErrorIs(t, err, expense.ErrAlreadyPaid)
	assert.ErrorIs(t, err, apierr.ErrConflict)
}

func TestService_Pay_DespesaVencidaPodeSerBaixada(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 80, d(2026, 5, 1))
	paid, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	require.NoError(t, err)
	assert.Equal(t, expense.StatusPaid, paid.Status)
}

func TestService_Pay_OutraOrganização(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 80, d(2026, 6, 20))
	_, err := e.svc.Pay(context.Background(), x.ID, uuid.New(), uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	assert.ErrorIs(t, err, apierr.ErrNotFound)
}

// ---- estorno ----

func TestService_Unpay_VoltaAPendenteELimpaCampos(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 7, 20))
	_, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	require.NoError(t, err)

	back, err := e.svc.Unpay(context.Background(), x.ID, e.org, uuid.New())
	require.NoError(t, err)
	assert.Equal(t, expense.StatusPending, back.Status)
	assert.Nil(t, back.PaidDate)
	assert.Nil(t, back.PaidAmount)
}

func TestService_Unpay_DespesaPendente(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 7, 20))
	_, err := e.svc.Unpay(context.Background(), x.ID, e.org, uuid.New())
	assert.ErrorIs(t, err, expense.ErrNotPaid)
}

func TestService_PayEUnpay_RegistramAuditoria(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 7, 20))
	_, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	require.NoError(t, err)
	_, err = e.svc.Unpay(context.Background(), x.ID, e.org, uuid.New())
	require.NoError(t, err)
	assert.Equal(t, []string{"expense:pay", "expense:unpay"}, e.auditor.events)
}

func TestService_Pay_FalhaNãoAudita(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 7, 20))
	in := expense.PayExpenseInput{PaidDate: d(2026, 6, 15)}
	_, _ = e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), in)
	_, _ = e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), in)
	assert.Len(t, e.auditor.events, 1)
}

// ---- despesa paga protegida ----

func TestService_Update_DespesaPaga_BloqueiaValorEVencimento(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	_, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	require.NoError(t, err)

	in := expense.CreateExpenseInput{Description: "Conta", Amount: 999, DueDate: d(2026, 6, 20), Category: "WATER"}
	_, err = e.svc.Update(context.Background(), x.ID, e.org, in)
	assert.ErrorIs(t, err, expense.ErrLocked)

	in = expense.CreateExpenseInput{Description: "Conta", Amount: 150, DueDate: d(2026, 6, 25), Category: "WATER"}
	_, err = e.svc.Update(context.Background(), x.ID, e.org, in)
	assert.ErrorIs(t, err, expense.ErrLocked)
}

func TestService_Update_DespesaPaga_PermiteDescriçãoECategoria(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	_, err := e.svc.Pay(context.Background(), x.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 15)})
	require.NoError(t, err)

	in := expense.CreateExpenseInput{Description: "Água de junho", Amount: 150, DueDate: d(2026, 6, 20), Category: "CONDO"}
	updated, err := e.svc.Update(context.Background(), x.ID, e.org, in)
	require.NoError(t, err)
	assert.Equal(t, "CONDO", updated.Category)
}

func TestService_Update_DespesaPendente_PermiteValor(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	in := expense.CreateExpenseInput{Description: "Conta", Amount: 175, DueDate: d(2026, 6, 20), Category: "WATER"}
	updated, err := e.svc.Update(context.Background(), x.ID, e.org, in)
	require.NoError(t, err)
	assert.Equal(t, 175.0, updated.Amount)
}

// ---- resumo ----

func TestService_Summary(t *testing.T) {
	e := newRegEnv()
	e.add(t, 100, d(2026, 6, 20))
	e.add(t, 40, d(2026, 6, 25))
	e.add(t, 30, d(2026, 6, 1))
	paga := e.add(t, 55, d(2026, 6, 2))
	_, err := e.svc.Pay(context.Background(), paga.ID, e.org, uuid.New(), expense.PayExpenseInput{PaidDate: d(2026, 6, 3)})
	require.NoError(t, err)

	sum, err := e.svc.Summary(context.Background(), e.org, expense.ListFilter{Status: expense.StatusPaid})
	require.NoError(t, err)
	assert.Equal(t, expense.Bucket{Count: 2, Total: 140}, sum.ToPay)
	assert.Equal(t, expense.Bucket{Count: 1, Total: 30}, sum.Overdue)
	assert.Equal(t, expense.Bucket{Count: 1, Total: 55}, sum.Paid)
}

// ---- handler ----

func expRouter(e *regEnv) http.Handler {
	r := chi.NewRouter()
	expense.NewHandler(e.svc).Register(r, noopAuthMW, noopWriteMw, noopWriteMw)
	return r
}

func call(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func TestHandler_Pay_Fluxo(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	r := expRouter(e)
	path := "/expenses/" + x.ID.String()

	rr := call(r, http.MethodPost, path+"/pay", `{"paid_date":"2026-06-15T00:00:00Z"}`)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"status":"PAID"`)
	assert.Contains(t, rr.Body.String(), `"paid_amount":150`)

	rr = call(r, http.MethodPost, path+"/pay", `{"paid_date":"2026-06-15T00:00:00Z"}`)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "EXPENSE_ALREADY_PAID")

	rr = call(r, http.MethodPut, path, `{"description":"x","amount":999,"due_date":"2026-06-20T00:00:00Z","category":"WATER"}`)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "EXPENSE_LOCKED")

	rr = call(r, http.MethodPost, path+"/unpay", "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"status":"PENDING"`)

	rr = call(r, http.MethodPost, path+"/unpay", "")
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "EXPENSE_NOT_PAID")
}

func TestHandler_Pay_Validações(t *testing.T) {
	e := newRegEnv()
	x := e.add(t, 150, d(2026, 6, 20))
	r := expRouter(e)
	path := "/expenses/" + x.ID.String() + "/pay"

	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, "/expenses/nao-uuid/pay", `{}`).Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, path, `{`).Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, path, `{}`).Code, "paid_date é obrigatório")
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, path, `{"paid_date":"2026-06-15T00:00:00Z","paid_amount":-1}`).Code)
	assert.Equal(t, http.StatusNotFound, call(r, http.MethodPost, "/expenses/"+uuid.New().String()+"/pay", `{"paid_date":"2026-06-15T00:00:00Z"}`).Code)
}

func TestHandler_List_Filtros(t *testing.T) {
	e := newRegEnv()
	e.add(t, 10, d(2026, 6, 1))
	e.add(t, 10, d(2026, 7, 1))
	r := expRouter(e)

	rr := call(r, http.MethodGet, "/expenses?status=LATE", "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"status":"LATE"`)
	assert.NotContains(t, rr.Body.String(), `"status":"PENDING"`)

	rr = call(r, http.MethodGet, "/expenses?from=2026-06-20&to=2026-07-31", "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.NotContains(t, rr.Body.String(), `"status":"LATE"`)

	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/expenses?status=XYZ", "").Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/expenses?from=01/06/2026", "").Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/expenses?unit_id=nao-uuid", "").Code)
}

func TestHandler_Summary(t *testing.T) {
	e := newRegEnv()
	e.add(t, 100, d(2026, 6, 20))
	e.add(t, 30, d(2026, 6, 1))
	rr := call(expRouter(e), http.MethodGet, "/expenses/summary?from=2026-06-01&to=2026-06-30", "")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"to_pay":{"count":1,"total":100}`)
	assert.Contains(t, rr.Body.String(), `"overdue":{"count":1,"total":30}`)
	assert.Contains(t, rr.Body.String(), `"paid":{"count":0,"total":0}`)
}

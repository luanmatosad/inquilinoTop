package lease_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/lease"
	"github.com/inquilinotop/api/internal/property"
	"github.com/inquilinotop/api/internal/tenant"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/validator"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func day(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }
func dayp(y int, m time.Month, d int) *time.Time {
	t := day(y, m, d)
	return &t
}

// ---- fakes ----

type fakeUnits struct{ known map[uuid.UUID]bool }

func (f *fakeUnits) GetUnit(_ context.Context, id, _ uuid.UUID) (*property.Unit, error) {
	if !f.known[id] {
		return nil, apierr.ErrNotFound
	}
	return &property.Unit{ID: id, IsActive: true}, nil
}

type fakeTenants struct{ known map[uuid.UUID]bool }

func (f *fakeTenants) GetByID(_ context.Context, id, _ uuid.UUID) (*tenant.Tenant, error) {
	if !f.known[id] {
		return nil, apierr.ErrNotFound
	}
	return &tenant.Tenant{ID: id, IsActive: true}, nil
}

type fakePayments struct {
	months      []string
	failOnMonth string
	canceled    int
	needReview  int
	cancelAfter time.Time
	cancelErr   error
}

func (f *fakePayments) GenerateRentMonth(_ context.Context, _, _, _ uuid.UUID, month string) error {
	if month == f.failOnMonth {
		return errors.New("falha ao gerar")
	}
	f.months = append(f.months, month)
	return nil
}

func (f *fakePayments) CancelFuturePending(_ context.Context, _, _ uuid.UUID, after time.Time) (int, int, error) {
	f.cancelAfter = after
	return f.canceled, f.needReview, f.cancelErr
}

type env struct {
	svc      *lease.Service
	repo     *mockLeaseRepo
	units    *fakeUnits
	tenants  *fakeTenants
	payments *fakePayments
	org, own uuid.UUID
	unit, tn uuid.UUID
}

func newEnv() *env {
	e := &env{
		repo:     newMockLeaseRepo(),
		units:    &fakeUnits{known: map[uuid.UUID]bool{}},
		tenants:  &fakeTenants{known: map[uuid.UUID]bool{}},
		payments: &fakePayments{},
		org:      uuid.New(), own: uuid.New(), unit: uuid.New(), tn: uuid.New(),
	}
	e.units.known[e.unit] = true
	e.tenants.known[e.tn] = true
	e.svc = lease.NewService(e.repo, newMockReadjustmentRepo(), &mockIndexRepo{}).
		WithRefs(e.units, e.tenants).
		WithPayments(e.payments)
	return e
}

func (e *env) in(start time.Time, end *time.Time) lease.CreateLeaseInput {
	return lease.CreateLeaseInput{UnitID: e.unit, TenantID: e.tn, StartDate: start, EndDate: end, RentAmount: 1500, PaymentDay: 5}
}

func (e *env) create(t *testing.T, in lease.CreateLeaseInput) *lease.CreateOutput {
	t.Helper()
	out, err := e.svc.Create(context.Background(), e.org, e.own, in)
	require.NoError(t, err)
	return out
}

// ---- validações ----

func TestService_Create_DatasIncoerentes(t *testing.T) {
	e := newEnv()
	for _, end := range []*time.Time{dayp(2026, 1, 1), dayp(2025, 12, 31)} {
		_, err := e.svc.Create(context.Background(), e.org, e.own, e.in(day(2026, 1, 1), end))
		assert.ErrorIs(t, err, lease.ErrInvalidDates)
	}
	assert.Empty(t, e.repo.leases, "nada deve ser criado")
}

func TestService_Create_UnidadeInexistenteOuDeOutraOrganização(t *testing.T) {
	e := newEnv()
	in := e.in(day(2026, 1, 1), nil)
	in.UnitID = uuid.New()
	_, err := e.svc.Create(context.Background(), e.org, e.own, in)
	assert.ErrorIs(t, err, lease.ErrUnitNotFound)
	assert.ErrorIs(t, err, apierr.ErrNotFound)
	assert.Empty(t, e.repo.leases)
}

func TestService_Create_InquilinoInexistenteOuDeOutraOrganização(t *testing.T) {
	e := newEnv()
	in := e.in(day(2026, 1, 1), nil)
	in.TenantID = uuid.New()
	_, err := e.svc.Create(context.Background(), e.org, e.own, in)
	assert.ErrorIs(t, err, lease.ErrTenantNotFound)
	assert.Empty(t, e.repo.leases)
}

func TestCreateLeaseInput_Validate_Notes(t *testing.T) {
	in := lease.CreateLeaseInput{UnitID: uuid.New(), TenantID: uuid.New(), StartDate: day(2026, 1, 1), RentAmount: 1, PaymentDay: 5}
	ok := "x"
	in.Notes = &ok
	assert.NoError(t, validator.Validate(in))
	big := make([]rune, 2001)
	for i := range big {
		big[i] = 'a'
	}
	s := string(big)
	in.Notes = &s
	assert.Error(t, validator.Validate(in))
}

func TestService_Create_GravaNotes(t *testing.T) {
	e := newEnv()
	in := e.in(day(2026, 1, 1), nil)
	n := "reajuste em janeiro"
	in.Notes = &n
	out := e.create(t, in)
	require.NotNil(t, out.Lease.Notes)
	assert.Equal(t, n, *out.Lease.Notes)
}

// ---- sobreposição ----

func TestService_Create_Sobreposição(t *testing.T) {
	e := newEnv()
	e.create(t, e.in(day(2026, 1, 1), dayp(2026, 12, 31)))

	_, err := e.svc.Create(context.Background(), e.org, e.own, e.in(day(2026, 6, 1), dayp(2027, 5, 31)))
	assert.ErrorIs(t, err, lease.ErrLeaseOverlap)
	assert.ErrorIs(t, err, apierr.ErrConflict)
	assert.Len(t, e.repo.leases, 1)
}

func TestService_Create_ContratoAbertoSobrepõeFuturo(t *testing.T) {
	e := newEnv()
	e.create(t, e.in(day(2026, 1, 1), nil))

	_, err := e.svc.Create(context.Background(), e.org, e.own, e.in(day(2030, 1, 1), dayp(2030, 12, 31)))
	assert.ErrorIs(t, err, lease.ErrLeaseOverlap)
}

func TestService_Create_PeríodoSequencial(t *testing.T) {
	e := newEnv()
	e.create(t, e.in(day(2026, 1, 1), dayp(2026, 12, 31)))

	_, err := e.svc.Create(context.Background(), e.org, e.own, e.in(day(2027, 1, 1), dayp(2027, 12, 31)))
	assert.NoError(t, err)
}

func TestService_Create_OutraUnidadeNãoSobrepõe(t *testing.T) {
	e := newEnv()
	e.create(t, e.in(day(2026, 1, 1), nil))
	other := uuid.New()
	e.units.known[other] = true
	in := e.in(day(2026, 1, 1), nil)
	in.UnitID = other
	_, err := e.svc.Create(context.Background(), e.org, e.own, in)
	assert.NoError(t, err)
}

func TestService_Create_ContratoEncerradoNãoSobrepõe(t *testing.T) {
	e := newEnv()
	first := e.create(t, e.in(day(2026, 1, 1), nil))
	_, err := e.svc.End(context.Background(), first.Lease.ID, e.org)
	require.NoError(t, err)

	_, err = e.svc.Create(context.Background(), e.org, e.own, e.in(day(2026, 1, 1), nil))
	assert.NoError(t, err)
}

// ---- geração de cobranças ----

func TestService_Create_GeraCobrançasContratoComPrazo(t *testing.T) {
	e := newEnv()
	in := e.in(day(2026, 1, 15), dayp(2026, 6, 14))
	in.GeneratePayments = true
	out := e.create(t, in)

	assert.Equal(t, []string{"2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"}, e.payments.months)
	assert.Equal(t, 6, out.PaymentsGenerated)
	assert.Empty(t, out.PaymentsError)
}

func TestService_Create_GeraDozeMesesContratoAberto(t *testing.T) {
	e := newEnv()
	in := e.in(day(2026, 11, 10), nil)
	in.GeneratePayments = true
	out := e.create(t, in)

	require.Len(t, e.payments.months, 12)
	assert.Equal(t, "2026-11", e.payments.months[0])
	assert.Equal(t, "2027-10", e.payments.months[11])
	assert.Equal(t, 12, out.PaymentsGenerated)
}

func TestService_Create_PrazoLongoLimitadoADozeMeses(t *testing.T) {
	e := newEnv()
	in := e.in(day(2026, 1, 1), dayp(2028, 12, 31))
	in.GeneratePayments = true
	e.create(t, in)
	assert.Len(t, e.payments.months, 12)
}

func TestService_Create_SemFlagNãoGera(t *testing.T) {
	e := newEnv()
	out := e.create(t, e.in(day(2026, 1, 1), dayp(2026, 6, 30)))
	assert.Empty(t, e.payments.months)
	assert.Equal(t, 0, out.PaymentsGenerated)
}

func TestService_Create_FalhaNaGeraçãoMantémContrato(t *testing.T) {
	e := newEnv()
	e.payments.failOnMonth = "2026-03"
	in := e.in(day(2026, 1, 1), dayp(2026, 6, 30))
	in.GeneratePayments = true
	out := e.create(t, in)

	assert.Len(t, e.repo.leases, 1, "contrato permanece criado")
	assert.Equal(t, 2, out.PaymentsGenerated)
	assert.NotEmpty(t, out.PaymentsError)
}

// ---- encerrar ----

func TestService_End_CancelaFuturasPendentes(t *testing.T) {
	e := newEnv()
	e.payments.canceled, e.payments.needReview = 4, 1
	created := e.create(t, e.in(day(2026, 1, 1), nil))

	out, err := e.svc.End(context.Background(), created.Lease.ID, e.org)
	require.NoError(t, err)
	assert.Equal(t, "ENDED", out.Lease.Status)
	assert.Equal(t, 4, out.PaymentsCanceled)
	assert.Equal(t, 1, out.PaymentsNeedReview)
	assert.False(t, e.payments.cancelAfter.IsZero(), "corte por data de vencimento é informado")
}

func TestService_End_JáEncerrado(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))
	_, err := e.svc.End(context.Background(), created.Lease.ID, e.org)
	require.NoError(t, err)

	_, err = e.svc.End(context.Background(), created.Lease.ID, e.org)
	assert.ErrorIs(t, err, lease.ErrLeaseNotActive)
}

func TestService_End_ErroAoCancelarCobrançasNãoDesfazEncerramento(t *testing.T) {
	e := newEnv()
	e.payments.cancelErr = errors.New("db down")
	created := e.create(t, e.in(day(2026, 1, 1), nil))

	out, err := e.svc.End(context.Background(), created.Lease.ID, e.org)
	require.NoError(t, err)
	assert.Equal(t, "ENDED", out.Lease.Status)
	assert.NotEmpty(t, out.PaymentsError)
}

// ---- renovar ----

func TestService_Renew_DataAnteriorAoFimAtual(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), dayp(2026, 12, 31)))

	_, err := e.svc.Renew(context.Background(), created.Lease.ID, e.org, lease.RenewLeaseInput{NewEndDate: day(2026, 6, 30)})
	assert.ErrorIs(t, err, lease.ErrInvalidDates)
}

func TestService_Renew_Válida(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), dayp(2026, 12, 31)))

	renewed, err := e.svc.Renew(context.Background(), created.Lease.ID, e.org, lease.RenewLeaseInput{NewEndDate: day(2027, 12, 31), RentAmount: 1700})
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", renewed.Status)
	assert.Equal(t, float64(1700), renewed.RentAmount)
}

func TestService_Renew_ContratoEncerrado(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))
	_, err := e.svc.End(context.Background(), created.Lease.ID, e.org)
	require.NoError(t, err)

	_, err = e.svc.Renew(context.Background(), created.Lease.ID, e.org, lease.RenewLeaseInput{NewEndDate: day(2030, 1, 1)})
	assert.ErrorIs(t, err, lease.ErrLeaseNotActive)
}

func TestService_Renew_SobreposiçãoComOutroContrato(t *testing.T) {
	e := newEnv()
	first := e.create(t, e.in(day(2026, 1, 1), dayp(2026, 12, 31)))
	e.create(t, e.in(day(2027, 3, 1), dayp(2027, 12, 31)))

	_, err := e.svc.Renew(context.Background(), first.Lease.ID, e.org, lease.RenewLeaseInput{NewEndDate: day(2027, 6, 30)})
	assert.ErrorIs(t, err, lease.ErrLeaseOverlap)
}

// ---- atualizar ----

func TestService_Update_NãoPermiteMudarStatus(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))
	_, err := e.svc.End(context.Background(), created.Lease.ID, e.org)
	require.NoError(t, err)

	_, err = e.svc.Update(context.Background(), created.Lease.ID, e.org, lease.UpdateLeaseInput{Status: "ACTIVE", RentAmount: 1500})
	assert.ErrorIs(t, err, lease.ErrStatusChange)
}

func TestService_Update_StatusOmitidoMantémAtual(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))

	updated, err := e.svc.Update(context.Background(), created.Lease.ID, e.org, lease.UpdateLeaseInput{RentAmount: 1800})
	require.NoError(t, err)
	assert.Equal(t, "ACTIVE", updated.Status)
	assert.Equal(t, float64(1800), updated.RentAmount)
}

func TestService_Update_FimAnteriorAoInício(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 6, 1), nil))
	_, err := e.svc.Update(context.Background(), created.Lease.ID, e.org, lease.UpdateLeaseInput{RentAmount: 1500, EndDate: dayp(2026, 5, 1)})
	assert.ErrorIs(t, err, lease.ErrInvalidDates)
}

func TestService_Update_FimQueCausaSobreposição(t *testing.T) {
	e := newEnv()
	first := e.create(t, e.in(day(2026, 1, 1), dayp(2026, 6, 30)))
	e.create(t, e.in(day(2026, 9, 1), dayp(2026, 12, 31)))

	_, err := e.svc.Update(context.Background(), first.Lease.ID, e.org, lease.UpdateLeaseInput{RentAmount: 1500, EndDate: dayp(2026, 10, 31)})
	assert.ErrorIs(t, err, lease.ErrLeaseOverlap)
}

// createLease e endLease devolvem só o contrato, para os testes que não olham a geração de cobranças.
func createLease(svc *lease.Service, orgID, ownerID uuid.UUID, in lease.CreateLeaseInput) (*lease.Lease, error) {
	out, err := svc.Create(context.Background(), orgID, ownerID, in)
	if err != nil {
		return nil, err
	}
	return out.Lease, nil
}

func endLease(svc *lease.Service, id, orgID uuid.UUID) (*lease.Lease, error) {
	out, err := svc.End(context.Background(), id, orgID)
	if err != nil {
		return nil, err
	}
	return out.Lease, nil
}

// ---- handler ----

func leaseRouter(e *env) http.Handler {
	r := chi.NewRouter()
	lease.NewHandler(e.svc).Register(r, authMWWithOwnerID(e.org), noopWriteMw, noopWriteMw)
	return r
}

func doJSON(r http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr
}

func createBody(e *env, start string, end string, extra string) string {
	endJSON := ""
	if end != "" {
		endJSON = `,"end_date":"` + end + `T00:00:00Z"`
	}
	return `{"unit_id":"` + e.unit.String() + `","tenant_id":"` + e.tn.String() + `","start_date":"` + start + `T00:00:00Z"` + endJSON + `,"rent_amount":1500,"payment_day":5` + extra + `}`
}

func TestHandler_Create_RetornaContagemDeCobranças(t *testing.T) {
	e := newEnv()
	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases", createBody(e, "2026-01-01", "2026-03-31", `,"generate_payments":true,"notes":"obs"`))
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"payments_generated":3`)
	assert.Contains(t, rr.Body.String(), `"notes":"obs"`)
}

func TestHandler_Create_Sobreposição_409(t *testing.T) {
	e := newEnv()
	r := leaseRouter(e)
	require.Equal(t, http.StatusCreated, doJSON(r, http.MethodPost, "/leases", createBody(e, "2026-01-01", "2026-12-31", "")).Code)

	rr := doJSON(r, http.MethodPost, "/leases", createBody(e, "2026-06-01", "", ""))
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "LEASE_OVERLAP")
}

func TestHandler_Create_DatasInválidas_422(t *testing.T) {
	e := newEnv()
	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases", createBody(e, "2026-06-01", "2026-05-01", ""))
	require.Equal(t, http.StatusUnprocessableEntity, rr.Code)
	assert.Contains(t, rr.Body.String(), "INVALID_DATES")
}

func TestHandler_Create_UnidadeInexistente_404(t *testing.T) {
	e := newEnv()
	body := strings.Replace(createBody(e, "2026-01-01", "", ""), e.unit.String(), uuid.New().String(), 1)
	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases", body)
	require.Equal(t, http.StatusNotFound, rr.Code)
	assert.Contains(t, rr.Body.String(), "UNIT_NOT_FOUND")
}

func TestHandler_Create_InquilinoInexistente_404(t *testing.T) {
	e := newEnv()
	body := strings.Replace(createBody(e, "2026-01-01", "", ""), e.tn.String(), uuid.New().String(), 1)
	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases", body)
	require.Equal(t, http.StatusNotFound, rr.Code)
	assert.Contains(t, rr.Body.String(), "TENANT_NOT_FOUND")
}

func TestHandler_End_RetornaCobrançasCanceladas(t *testing.T) {
	e := newEnv()
	e.payments.canceled, e.payments.needReview = 3, 2
	created := e.create(t, e.in(day(2026, 1, 1), nil))

	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases/"+created.Lease.ID.String()+"/end", "")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"status":"ENDED"`)
	assert.Contains(t, rr.Body.String(), `"payments_canceled":3`)
	assert.Contains(t, rr.Body.String(), `"payments_need_review":2`)
}

func TestHandler_End_JáEncerrado_409(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))
	r := leaseRouter(e)
	path := "/leases/" + created.Lease.ID.String() + "/end"
	require.Equal(t, http.StatusOK, doJSON(r, http.MethodPost, path, "").Code)

	rr := doJSON(r, http.MethodPost, path, "")
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "LEASE_NOT_ACTIVE")
}

func TestHandler_Update_MudarStatus_409(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))
	rr := doJSON(leaseRouter(e), http.MethodPut, "/leases/"+created.Lease.ID.String(), `{"rent_amount":1500,"status":"CANCELED"}`)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "STATUS_CHANGE_NOT_ALLOWED")
}

func TestHandler_Renew_DataAnterior_422(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), dayp(2026, 12, 31)))
	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases/"+created.Lease.ID.String()+"/renew", `{"new_end_date":"2026-06-30T00:00:00Z"}`)
	require.Equal(t, http.StatusUnprocessableEntity, rr.Code)
	assert.Contains(t, rr.Body.String(), "INVALID_DATES")
}

func TestHandler_Renew_ContratoEncerrado_409(t *testing.T) {
	e := newEnv()
	created := e.create(t, e.in(day(2026, 1, 1), nil))
	_, err := e.svc.End(context.Background(), created.Lease.ID, e.org)
	require.NoError(t, err)

	rr := doJSON(leaseRouter(e), http.MethodPost, "/leases/"+created.Lease.ID.String()+"/renew", `{"new_end_date":"2030-06-30T00:00:00Z"}`)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "LEASE_NOT_ACTIVE")
}

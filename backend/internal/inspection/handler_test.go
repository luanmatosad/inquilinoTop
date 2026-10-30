package inspection_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/inspection"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func passMW(next http.Handler) http.Handler { return next }

// router injeta usuário e organização com ids diferentes, como o JWT real.
func (e *env) router() http.Handler {
	r := chi.NewRouter()
	authMW := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(auth.WithOwnerIDOrgIDRole(req.Context(), e.user, e.org, "admin")))
		})
	}
	inspection.NewHandler(e.svc).Register(r, authMW, passMW, passMW)
	return r
}

func call(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func (e *env) createBody(typ string, extra string) string {
	return `{"lease_id":"` + e.lease.String() + `","type":"` + typ + `","inspected_at":"2026-03-01T00:00:00Z"` + extra + `}`
}

func TestHandler_Create_Sucesso(t *testing.T) {
	e := newEnv()
	rr := call(e.router(), http.MethodPost, "/inspections", e.createBody("ENTRY", `,"general_notes":"ok"`))
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"status":"DRAFT"`)
	assert.Contains(t, rr.Body.String(), `"items":[]`)
	assert.Equal(t, []uuid.UUID{e.user}, e.auditor.owners, "auditoria usa o usuário, não a organização")
}

func TestHandler_Create_Validações(t *testing.T) {
	e := newEnv()
	r := e.router()
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, "/inspections", `{`).Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, "/inspections", e.createBody("OUTRO", "")).Code, "tipo inválido")
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, "/inspections", `{"type":"ENTRY"}`).Code, "contrato e data obrigatórios")
}

func TestHandler_Create_ContratoDeOutraOrganização_404(t *testing.T) {
	e := newEnv()
	body := strings.Replace(e.createBody("ENTRY", ""), e.lease.String(), uuid.New().String(), 1)
	rr := call(e.router(), http.MethodPost, "/inspections", body)
	require.Equal(t, http.StatusNotFound, rr.Code)
	assert.Contains(t, rr.Body.String(), "LEASE_NOT_FOUND")
}

func TestHandler_Create_Duplicado_409(t *testing.T) {
	e := newEnv()
	r := e.router()
	require.Equal(t, http.StatusCreated, call(r, http.MethodPost, "/inspections", e.createBody("ENTRY", "")).Code)
	rr := call(r, http.MethodPost, "/inspections", e.createBody("ENTRY", ""))
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "INSPECTION_DUPLICATE")
}

func TestHandler_Create_CopiaDaEntrada(t *testing.T) {
	e := newEnv()
	entry := e.create(t, inspection.TypeEntry, false)
	e.item(t, entry.ID, "Sala", "Piso", inspection.ConditionGood)
	rr := call(e.router(), http.MethodPost, "/inspections", e.createBody("EXIT", `,"copy_from_entry":true`))
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"room":"Sala"`)
}

func TestHandler_List(t *testing.T) {
	e := newEnv()
	r := e.router()
	rr := call(r, http.MethodGet, "/inspections", "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"data":[]`, "lista vazia nunca nil")

	e.create(t, inspection.TypeEntry, false)
	e.create(t, inspection.TypeExit, false)
	rr = call(r, http.MethodGet, "/inspections?type=EXIT&lease_id="+e.lease.String(), "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"type":"EXIT"`)
	assert.NotContains(t, rr.Body.String(), `"type":"ENTRY"`)

	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/inspections?type=XYZ", "").Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/inspections?status=XYZ", "").Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/inspections?lease_id=nao-uuid", "").Code)
}

func TestHandler_Get(t *testing.T) {
	e := newEnv()
	r := e.router()
	d := e.create(t, inspection.TypeEntry, false)
	e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)

	rr := call(r, http.MethodGet, "/inspections/"+d.ID.String(), "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"item":"Piso"`)

	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/inspections/nao-uuid", "").Code)
	assert.Equal(t, http.StatusNotFound, call(r, http.MethodGet, "/inspections/"+uuid.New().String(), "").Code)
}

func TestHandler_UpdateEDelete(t *testing.T) {
	e := newEnv()
	r := e.router()
	d := e.create(t, inspection.TypeEntry, false)
	path := "/inspections/" + d.ID.String()

	rr := call(r, http.MethodPut, path, `{"inspected_at":"2026-04-01T00:00:00Z","general_notes":"novas"}`)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), "novas")
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPut, path, `{}`).Code)

	rr = call(r, http.MethodDelete, path, "")
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, http.StatusNotFound, call(r, http.MethodGet, path, "").Code)
	assert.Equal(t, http.StatusNotFound, call(r, http.MethodDelete, path, "").Code)
}

func TestHandler_Itens_Fluxo(t *testing.T) {
	e := newEnv()
	r := e.router()
	d := e.create(t, inspection.TypeEntry, false)
	base := "/inspections/" + d.ID.String() + "/items"

	rr := call(r, http.MethodPost, base, `{"room":"Sala","item":"Piso","condition":"GOOD"}`)
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, base, `{"room":"Sala","item":"Piso","condition":"BROKEN"}`).Code, "condição inválida")
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodPost, base, `{"item":"Piso","condition":"GOOD"}`).Code)

	it, err := e.repo.ListItems(context.Background(), d.ID, e.org)
	require.NoError(t, err)
	require.Len(t, it, 1)
	itemPath := base + "/" + it[0].ID.String()

	rr = call(r, http.MethodPut, itemPath, `{"room":"Sala","item":"Piso","condition":"POOR"}`)
	require.Equal(t, http.StatusOK, rr.Code)
	assert.Contains(t, rr.Body.String(), `"condition":"POOR"`)

	assert.Equal(t, http.StatusOK, call(r, http.MethodDelete, itemPath, "").Code)
	assert.Equal(t, http.StatusNotFound, call(r, http.MethodDelete, itemPath, "").Code)
	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodDelete, base+"/nao-uuid", "").Code)
}

func TestHandler_Concluir_E_NãoEditável_409(t *testing.T) {
	e := newEnv()
	r := e.router()
	d := e.create(t, inspection.TypeEntry, false)
	completePath := "/inspections/" + d.ID.String() + "/complete"

	rr := call(r, http.MethodPost, completePath, "")
	require.Equal(t, http.StatusUnprocessableEntity, rr.Code, "sem itens")
	assert.Contains(t, rr.Body.String(), "INSPECTION_WITHOUT_ITEMS")

	e.item(t, d.ID, "Sala", "Piso", inspection.ConditionGood)
	rr = call(r, http.MethodPost, completePath, "")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"status":"COMPLETED"`)

	for name, req := range map[string][2]string{
		"editar laudo": {http.MethodPut, `{"inspected_at":"2026-04-01T00:00:00Z"}`},
		"concluir":     {http.MethodPost, ``},
	} {
		path := "/inspections/" + d.ID.String()
		if name == "concluir" {
			path = completePath
		}
		rr = call(r, req[0], path, req[1])
		require.Equal(t, http.StatusConflict, rr.Code, name)
		assert.Contains(t, rr.Body.String(), "INSPECTION_NOT_EDITABLE", name)
	}
	rr = call(r, http.MethodPost, "/inspections/"+d.ID.String()+"/items", `{"room":"A","item":"B","condition":"GOOD"}`)
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "INSPECTION_NOT_EDITABLE")
}

func TestHandler_Compare(t *testing.T) {
	e := newEnv()
	r := e.router()
	path := "/leases/" + e.lease.String() + "/inspections/compare"

	rr := call(r, http.MethodGet, path, "")
	require.Equal(t, http.StatusConflict, rr.Code)
	assert.Contains(t, rr.Body.String(), "COMPARISON_UNAVAILABLE")

	completed(t, e, inspection.TypeEntry, map[[2]string]string{{"Sala", "Piso"}: "GOOD"})
	completed(t, e, inspection.TypeExit, map[[2]string]string{{"Sala", "Piso"}: "DAMAGED"})
	rr = call(r, http.MethodGet, path, "")
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, rr.Body.String(), `"worsened":true`)

	assert.Equal(t, http.StatusBadRequest, call(r, http.MethodGet, "/leases/nao-uuid/inspections/compare", "").Code)
	assert.Equal(t, http.StatusNotFound, call(r, http.MethodGet, "/leases/"+uuid.New().String()+"/inspections/compare", "").Code)
}

func TestHandler_OrganizaçãoDistintaDoUsuário(t *testing.T) {
	// regressão: o handler usa a organização (não o id do usuário) para escopar os dados
	e := newEnv()
	r := e.router()
	require.Equal(t, http.StatusCreated, call(r, http.MethodPost, "/inspections", e.createBody("ENTRY", "")).Code)
	list, err := e.repo.List(context.Background(), e.org, inspection.Filter{})
	require.NoError(t, err)
	require.Len(t, list, 1)
	assert.Equal(t, e.org, list[0].OrganizationID)
	assert.NotEqual(t, e.user, e.org)
}

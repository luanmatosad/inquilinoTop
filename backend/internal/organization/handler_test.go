package organization_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/organization"
)

func postCreateOrg(t *testing.T, h *organization.Handler, userID uuid.UUID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/organizations", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(setupTestContext(userID, uuid.Nil))
	rec := httptest.NewRecorder()
	h.CreateOrganization(rec, req)
	return rec
}

func TestHandler_CreateOrganization_Cria201(t *testing.T) {
	h := organization.NewHandler(newTestService(newMockRepo()))

	rec := postCreateOrg(t, h, uuid.New(), `{"name":"Administradora X"}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperado 201, veio %d: %s", rec.Code, rec.Body.String())
	}
}

func TestHandler_CreateOrganization_SegundaOrgRetorna409(t *testing.T) {
	h := organization.NewHandler(newTestService(newMockRepo()))
	userID := uuid.New()

	if rec := postCreateOrg(t, h, userID, `{"name":"A"}`); rec.Code != http.StatusCreated {
		t.Fatalf("primeira criação: esperado 201, veio %d", rec.Code)
	}

	rec := postCreateOrg(t, h, userID, `{"name":"B"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("segunda criação: esperado 409, veio %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ALREADY_HAS_ORG") {
		t.Fatalf("segunda criação: código ALREADY_HAS_ORG ausente no corpo: %s", rec.Body.String())
	}
}

func TestHandler_CreateOrganization_JSONInvalidoRetorna400(t *testing.T) {
	h := organization.NewHandler(newTestService(newMockRepo()))

	rec := postCreateOrg(t, h, uuid.New(), `{"name":`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400, veio %d", rec.Code)
	}
}

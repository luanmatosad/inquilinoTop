package document_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/document"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func noopAuthMW(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

func newDocRouter() chi.Router {
	svc := document.NewService(newMockDocRepo(), newMockStorage())
	h := document.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r, noopAuthMW)
	return r
}

func TestHandler_ListByEntity_SemParams(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/documents", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByEntity_EntityIDInválido(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/documents?entity_type=property&entity_id=nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_ListByEntity_Válido(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodGet,
		"/api/v1/documents?entity_type=property&entity_id="+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	require.Equal(t, http.StatusOK, rr.Code)
	var body map[string]interface{}
	json.NewDecoder(rr.Body).Decode(&body)
	assert.NotNil(t, body["data"])
}

func TestHandler_Upload_SemArquivo(t *testing.T) {
	r := newDocRouter()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	mw.WriteField("entity_type", "property")
	mw.WriteField("entity_id", uuid.New().String())
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/documents", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Upload_SemParams(t *testing.T) {
	r := newDocRouter()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "doc.pdf")
	fw.Write([]byte("conteúdo"))
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/documents", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Upload_EntityIDInválido(t *testing.T) {
	r := newDocRouter()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "doc.pdf")
	fw.Write([]byte("conteúdo"))
	mw.WriteField("entity_type", "property")
	mw.WriteField("entity_id", "nao-e-uuid")
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/documents", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Download_IDInválido(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/documents/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Download_NãoEncontrado(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/documents/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestHandler_Delete_IDInválido(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/documents/nao-e-uuid", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}

func TestHandler_Delete_NãoEncontrado(t *testing.T) {
	r := newDocRouter()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/documents/"+uuid.New().String(), nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

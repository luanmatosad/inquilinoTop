package notification_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/internal/notification"
)

func TestHandler_ProcessRouteRemovida(t *testing.T) {
	r := chi.NewRouter()
	h := notification.NewHandler(nil)
	passthrough := func(next http.Handler) http.Handler { return next }
	h.Register(r, passthrough)

	req := httptest.NewRequest(http.MethodPost, "/notifications/process", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	// "process" casa com /notifications/{id}, que só aceita GET: 405. Não existe mais rota de envio.
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST /notifications/process: esperado 405, veio %d", rec.Code)
	}
}

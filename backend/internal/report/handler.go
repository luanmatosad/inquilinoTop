package report

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Register(r chi.Router, authMW, readMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/reports/overview", h.overview)
		r.With(readMw).Get("/reports/by-property", h.byProperty)
	})
}

// params lê organização e ano; responde o erro e devolve ok=false se algo estiver errado.
func params(w http.ResponseWriter, r *http.Request) (uuid.UUID, int, bool) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return uuid.Nil, 0, false
	}
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_YEAR", "informe o ano (year=AAAA)")
		return uuid.Nil, 0, false
	}
	return orgID, year, true
}

func fail(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrInvalidYear) {
		httputil.Err(w, http.StatusBadRequest, "INVALID_YEAR", "ano inválido")
		return
	}
	slog.Error("report: consulta falhou", "error", err)
	httputil.Err(w, http.StatusInternalServerError, "REPORT_FAILED", "não foi possível gerar o relatório")
}

// @Summary Totais do ano e série mensal de recebido e despesas (por data de pagamento)
// @Tags reports
// @Security BearerAuth
// @Produce json
// @Param year query int true "Ano (AAAA)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /reports/overview [get]
func (h *Handler) overview(w http.ResponseWriter, r *http.Request) {
	orgID, year, ok := params(w, r)
	if !ok {
		return
	}
	o, err := h.svc.Overview(r.Context(), orgID, year)
	if err != nil {
		fail(w, err)
		return
	}
	httputil.OK(w, o)
}

// @Summary Recebido, despesas e resultado por unidade no ano
// @Tags reports
// @Security BearerAuth
// @Produce json
// @Param year query int true "Ano (AAAA)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /reports/by-property [get]
func (h *Handler) byProperty(w http.ResponseWriter, r *http.Request) {
	orgID, year, ok := params(w, r)
	if !ok {
		return
	}
	b, err := h.svc.ByProperty(r.Context(), orgID, year)
	if err != nil {
		fail(w, err)
		return
	}
	httputil.OK(w, b)
}

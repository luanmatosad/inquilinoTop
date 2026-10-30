package inspection

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
	"github.com/inquilinotop/api/pkg/validator"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler, readMw func(http.Handler) http.Handler, writeMw func(http.Handler) http.Handler) {
	r.Group(func(r chi.Router) {
		r.Use(authMW)
		r.With(readMw).Get("/inspections", h.list)
		r.With(writeMw).Post("/inspections", h.create)
		r.With(readMw).Get("/inspections/{id}", h.get)
		r.With(writeMw).Put("/inspections/{id}", h.update)
		r.With(writeMw).Delete("/inspections/{id}", h.delete)
		r.With(writeMw).Post("/inspections/{id}/complete", h.complete)
		r.With(writeMw).Post("/inspections/{id}/items", h.addItem)
		r.With(writeMw).Put("/inspections/{id}/items/{itemId}", h.updateItem)
		r.With(writeMw).Delete("/inspections/{id}/items/{itemId}", h.deleteItem)
		r.With(readMw).Get("/leases/{id}/inspections/compare", h.compare)
	})
}

// org devolve a organização do contexto; responde 401 e devolve false se ausente.
func org(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	orgID := auth.OrganizationIDFromCtx(r.Context())
	if orgID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "organização não encontrada")
		return uuid.Nil, false
	}
	return orgID, true
}

func pathID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", name+" inválido")
		return uuid.Nil, false
	}
	return id, true
}

func decode(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return false
	}
	if err := validator.Validate(dst); err != nil {
		httputil.ValidationErr(w, err)
		return false
	}
	return true
}

// writeErr traduz os erros de regra do laudo; devolve false se err não for um deles.
func writeErr(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, ErrNotEditable):
		httputil.Err(w, http.StatusConflict, "INSPECTION_NOT_EDITABLE", "laudo concluído não pode ser alterado")
	case errors.Is(err, ErrDuplicate):
		httputil.Err(w, http.StatusConflict, "INSPECTION_DUPLICATE", "já existe laudo ativo desse tipo no contrato")
	case errors.Is(err, ErrComparisonUnavailable):
		httputil.Err(w, http.StatusConflict, "COMPARISON_UNAVAILABLE", "a comparação exige laudos de entrada e de saída concluídos")
	case errors.Is(err, ErrNoItems):
		httputil.Err(w, http.StatusUnprocessableEntity, "INSPECTION_WITHOUT_ITEMS", "o laudo precisa de ao menos um item para ser concluído")
	case errors.Is(err, ErrInvalidFilter):
		httputil.Err(w, http.StatusBadRequest, "INVALID_FILTER", "filtro inválido")
	case errors.Is(err, ErrLeaseNotFound):
		httputil.Err(w, http.StatusNotFound, "LEASE_NOT_FOUND", "contrato não encontrado")
	case errors.Is(err, apierr.ErrNotFound):
		httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "não encontrado")
	default:
		return false
	}
	return true
}

func fail(w http.ResponseWriter, err error, code string) {
	if writeErr(w, err) {
		return
	}
	slog.Error("inspection: "+code, "error", err)
	httputil.Err(w, http.StatusInternalServerError, code, err.Error())
}

// @Summary Lista laudos de vistoria
// @Tags inspections
// @Security BearerAuth
// @Produce json
// @Param lease_id query string false "ID do contrato"
// @Param type query string false "ENTRY ou EXIT"
// @Param status query string false "DRAFT ou COMPLETED"
// @Success 200 {array} Inspection
// @Failure 400 {object} map[string]interface{}
// @Router /inspections [get]
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	f := Filter{Type: q.Get("type"), Status: q.Get("status")}
	if v := q.Get("lease_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			httputil.Err(w, http.StatusBadRequest, "INVALID_FILTER", "lease_id inválido")
			return
		}
		f.LeaseID = &id
	}
	list, err := h.svc.List(r.Context(), orgID, f)
	if err != nil {
		fail(w, err, "LIST_FAILED")
		return
	}
	httputil.OK(w, list)
}

// @Summary Cria laudo de vistoria
// @Description Cria em DRAFT. Em EXIT, copy_from_entry copia os itens do laudo de entrada do contrato.
// @Tags inspections
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body CreateInspectionInput true "Dados do laudo"
// @Success 201 {object} Detail
// @Failure 404 {object} map[string]interface{} "LEASE_NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "INSPECTION_DUPLICATE"
// @Router /inspections [post]
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	var in CreateInspectionInput
	if !decode(w, r, &in) {
		return
	}
	d, err := h.svc.Create(r.Context(), orgID, auth.OwnerIDFromCtx(r.Context()), in)
	if err != nil {
		fail(w, err, "CREATE_FAILED")
		return
	}
	httputil.Created(w, d)
}

// @Summary Busca laudo com itens
// @Tags inspections
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do laudo"
// @Success 200 {object} Detail
// @Failure 404 {object} map[string]interface{}
// @Router /inspections/{id} [get]
func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	d, err := h.svc.Get(r.Context(), id, orgID)
	if err != nil {
		fail(w, err, "GET_FAILED")
		return
	}
	httputil.OK(w, d)
}

// @Summary Atualiza data e observações do laudo
// @Tags inspections
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do laudo"
// @Param body body UpdateInspectionInput true "Dados do laudo"
// @Success 200 {object} Inspection
// @Failure 409 {object} map[string]interface{} "INSPECTION_NOT_EDITABLE"
// @Router /inspections/{id} [put]
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in UpdateInspectionInput
	if !decode(w, r, &in) {
		return
	}
	insp, err := h.svc.Update(r.Context(), id, orgID, in)
	if err != nil {
		fail(w, err, "UPDATE_FAILED")
		return
	}
	httputil.OK(w, insp)
}

// @Summary Exclui laudo (soft-delete)
// @Tags inspections
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do laudo"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /inspections/{id} [delete]
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), id, orgID); err != nil {
		fail(w, err, "DELETE_FAILED")
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

// @Summary Conclui o laudo
// @Description Exige ao menos um item; depois disso o laudo fica somente leitura.
// @Tags inspections
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do laudo"
// @Success 200 {object} Inspection
// @Failure 409 {object} map[string]interface{} "INSPECTION_NOT_EDITABLE"
// @Failure 422 {object} map[string]interface{} "INSPECTION_WITHOUT_ITEMS"
// @Router /inspections/{id}/complete [post]
func (h *Handler) complete(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	insp, err := h.svc.Complete(r.Context(), id, orgID, auth.OwnerIDFromCtx(r.Context()))
	if err != nil {
		fail(w, err, "COMPLETE_FAILED")
		return
	}
	httputil.OK(w, insp)
}

// @Summary Adiciona item ao laudo
// @Tags inspections
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do laudo"
// @Param body body ItemInput true "Dados do item"
// @Success 201 {object} Item
// @Failure 409 {object} map[string]interface{} "INSPECTION_NOT_EDITABLE"
// @Router /inspections/{id}/items [post]
func (h *Handler) addItem(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in ItemInput
	if !decode(w, r, &in) {
		return
	}
	it, err := h.svc.AddItem(r.Context(), id, orgID, in)
	if err != nil {
		fail(w, err, "CREATE_ITEM_FAILED")
		return
	}
	httputil.Created(w, it)
}

// @Summary Atualiza item do laudo
// @Tags inspections
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param id path string true "ID do laudo"
// @Param itemId path string true "ID do item"
// @Param body body ItemInput true "Dados do item"
// @Success 200 {object} Item
// @Failure 409 {object} map[string]interface{} "INSPECTION_NOT_EDITABLE"
// @Router /inspections/{id}/items/{itemId} [put]
func (h *Handler) updateItem(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	itemID, ok := pathID(w, r, "itemId")
	if !ok {
		return
	}
	var in ItemInput
	if !decode(w, r, &in) {
		return
	}
	it, err := h.svc.UpdateItem(r.Context(), itemID, id, orgID, in)
	if err != nil {
		fail(w, err, "UPDATE_ITEM_FAILED")
		return
	}
	httputil.OK(w, it)
}

// @Summary Remove item do laudo (soft-delete)
// @Tags inspections
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do laudo"
// @Param itemId path string true "ID do item"
// @Success 200 {object} map[string]interface{}
// @Failure 409 {object} map[string]interface{} "INSPECTION_NOT_EDITABLE"
// @Router /inspections/{id}/items/{itemId} [delete]
func (h *Handler) deleteItem(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	itemID, ok := pathID(w, r, "itemId")
	if !ok {
		return
	}
	if err := h.svc.DeleteItem(r.Context(), itemID, id, orgID); err != nil {
		fail(w, err, "DELETE_ITEM_FAILED")
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}

// @Summary Compara laudo de entrada e de saída do contrato
// @Description Pareia itens por ambiente e item; worsened é true quando a saída é pior que a entrada.
// @Tags inspections
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do contrato"
// @Success 200 {object} Comparison
// @Failure 404 {object} map[string]interface{} "LEASE_NOT_FOUND"
// @Failure 409 {object} map[string]interface{} "COMPARISON_UNAVAILABLE"
// @Router /leases/{id}/inspections/compare [get]
func (h *Handler) compare(w http.ResponseWriter, r *http.Request) {
	orgID, ok := org(w, r)
	if !ok {
		return
	}
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	c, err := h.svc.Compare(r.Context(), id, orgID)
	if err != nil {
		fail(w, err, "COMPARE_FAILED")
		return
	}
	httputil.OK(w, c)
}

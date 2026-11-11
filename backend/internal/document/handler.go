package document

import (
	"errors"
	"io"
	"net/http"
	"strconv"

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

func (h *Handler) Register(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/documents", h.listByEntity)
	r.With(authMW).Post("/documents", h.upload)
	r.With(authMW).Get("/documents/{id}", h.download)
	r.With(authMW).Delete("/documents/{id}", h.delete)
}

// @Summary Lista os documentos de uma entidade
// @Tags documents
// @Security BearerAuth
// @Produce json
// @Param entity_type query string true "Tipo da entidade"
// @Param entity_id query string true "ID da entidade (UUID)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /documents [get]
func (h *Handler) listByEntity(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	entityType := r.URL.Query().Get("entity_type")
	entityIDStr := r.URL.Query().Get("entity_id")

	if entityType == "" || entityIDStr == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_PARAMS", "entity_type e entity_id são obrigatórios")
		return
	}

	entityID, err := uuid.Parse(entityIDStr)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "entity_id inválido")
		return
	}

	list, err := h.svc.ListByEntity(r.Context(), ownerID, entityType, entityID)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LIST_FAILED", err.Error())
		return
	}
	if list == nil {
		list = []Document{}
	}
	httputil.OK(w, list)
}

// @Summary Envia um documento (multipart) vinculado a uma entidade
// @Tags documents
// @Security BearerAuth
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Arquivo"
// @Param entity_type formData string true "Tipo da entidade"
// @Param entity_id formData string true "ID da entidade (UUID)"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /documents [post]
func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		httputil.Err(w, http.StatusBadRequest, "PARSE_ERROR", "falha ao processar upload")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "NO_FILE", "arquivo não encontrado")
		return
	}
	defer file.Close()

	entityType := r.FormValue("entity_type")
	entityID := r.FormValue("entity_id")
	filename := header.Filename

	if entityType == "" || entityID == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_PARAMS", "entity_type, entity_id são obrigatórios")
		return
	}

	_, err = uuid.Parse(entityID)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ENTITY_ID", "entity_id inválido")
		return
	}

	mimeType := header.Header.Get("Content-Type")
	sizeBytes := int(header.Size)

	in := CreateDocumentInput{
		EntityType: entityType,
		EntityID:   entityID,
		Filename:  filename,
		MimeType:  mimeType,
		SizeBytes: sizeBytes,
	}

	if err := validator.Validate(in); err != nil {
		httputil.ValidationErr(w, err)
		return
	}

	doc, err := h.svc.Upload(r.Context(), ownerID, in, file)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "UPLOAD_FAILED", err.Error())
		return
	}

	httputil.Created(w, doc)
}

// @Summary Faz o download de um documento
// @Tags documents
// @Security BearerAuth
// @Produce application/octet-stream
// @Param id path string true "ID do documento"
// @Success 200 {file} binary
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /documents/{id} [get]
func (h *Handler) download(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}

	doc, err := h.svc.GetDocument(r.Context(), id, ownerID)
	if err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "documento não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "GET_FAILED", err.Error())
		return
	}

	rc, err := h.svc.LoadFile(r.Context(), doc.FilePath)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "LOAD_FAILED", err.Error())
		return
	}
	defer rc.Close()

	w.Header().Set("Content-Type", doc.MimeType)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+doc.Filename+"\"")
	w.Header().Set("Content-Length", strconv.Itoa(doc.SizeBytes))
	io.Copy(w, rc)
}

// @Summary Remove um documento
// @Tags documents
// @Security BearerAuth
// @Produce json
// @Param id path string true "ID do documento"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /documents/{id} [delete]
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	ownerID := auth.OwnerIDFromCtx(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_ID", "id inválido")
		return
	}

	if err := h.svc.Delete(r.Context(), id, ownerID); err != nil {
		if errors.Is(err, apierr.ErrNotFound) {
			httputil.Err(w, http.StatusNotFound, "NOT_FOUND", "documento não encontrado")
			return
		}
		httputil.Err(w, http.StatusInternalServerError, "DELETE_FAILED", err.Error())
		return
	}

	httputil.OK(w, map[string]bool{"deleted": true})
}
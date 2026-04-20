package identity

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router) {
	r.Post("/api/v1/auth/register", h.register)
	r.Post("/api/v1/auth/login", h.login)
	r.Post("/api/v1/auth/refresh", h.refresh)
	r.Post("/api/v1/auth/logout", h.logout)
}

type credentialsInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// @Summary Registrar novo usuário
// @Tags auth
// @Accept json
// @Produce json
// @Param body body credentialsInput true "Email e senha"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /auth/register [post]
func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var in credentialsInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if in.Email == "" || in.Password == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_FIELDS", "email e senha são obrigatórios")
		return
	}
	result, err := h.svc.Register(in.Email, in.Password)
	if err != nil {
		httputil.Err(w, http.StatusConflict, "REGISTER_FAILED", err.Error())
		return
	}
	httputil.Created(w, result)
}

// @Summary Login
// @Tags auth
// @Accept json
// @Produce json
// @Param body body credentialsInput true "Email e senha"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/login [post]
func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var in credentialsInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	result, err := h.svc.Login(in.Email, in.Password)
	if err != nil {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "credenciais inválidas")
		return
	}
	httputil.OK(w, result)
}

type refreshInput struct {
	RefreshToken string `json:"refresh_token"`
}

// @Summary Renovar token
// @Tags auth
// @Accept json
// @Produce json
// @Param body body refreshInput true "Refresh token"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/refresh [post]
func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var in refreshInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.RefreshToken == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_REFRESH_TOKEN", "refresh_token é obrigatório")
		return
	}
	result, err := h.svc.Refresh(in.RefreshToken)
	if err != nil {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_REFRESH_TOKEN", err.Error())
		return
	}
	httputil.OK(w, result)
}

// @Summary Logout
// @Tags auth
// @Accept json
// @Produce json
// @Param body body refreshInput true "Refresh token"
// @Success 200 {object} map[string]interface{}
// @Router /auth/logout [post]
func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	var in refreshInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.RefreshToken == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_REFRESH_TOKEN", "refresh_token é obrigatório")
		return
	}
	h.svc.Logout(in.RefreshToken)
	httputil.OK(w, map[string]bool{"logged_out": true})
}

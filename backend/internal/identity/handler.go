package identity

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/inquilinotop/api/pkg/httputil"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r chi.Router) {
	r.Post("/auth/register", h.register)
	r.Post("/auth/login", h.login)
	r.Post("/auth/2fa/login", h.login2FA)
	r.Post("/auth/refresh", h.refresh)
	r.Post("/auth/logout", h.logout)
}

func (h *Handler) RegisterProtected(r chi.Router, authMW func(http.Handler) http.Handler) {
	r.With(authMW).Get("/auth/profile", h.getProfile)
	r.With(authMW).Put("/auth/profile", h.updateProfile)
	r.With(authMW).Post("/auth/2fa/setup", h.setup2FA)
	r.With(authMW).Post("/auth/2fa/verify", h.verify2FA)
	r.With(authMW).Post("/auth/2fa/disable", h.disable2FA)
	r.With(authMW).Get("/auth/notification-preferences", h.getNotificationPreferences)
	r.With(authMW).Put("/auth/notification-preferences", h.updateNotificationPreferences)
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
	if !strings.Contains(in.Email, "@") {
		httputil.Err(w, http.StatusBadRequest, "INVALID_EMAIL", "email inválido")
		return
	}
	if len(in.Password) < 8 {
		httputil.Err(w, http.StatusBadRequest, "WEAK_PASSWORD", "senha deve ter no mínimo 8 caracteres")
		return
	}
	result, err := h.svc.Register(r.Context(), in.Email, in.Password)
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
	result, err := h.svc.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "credenciais inválidas")
		return
	}

	if result.TwoFactorRequired {
		httputil.OK(w, map[string]interface{}{
			"two_factor_required": true,
			"temp_token":        result.TempToken,
		})
		return
	}
	httputil.OK(w, result)
}

type twoFactorLoginInput struct {
	TempToken string `json:"temp_token"`
	Code     string `json:"code"`
}

// @Summary Login com 2FA
// @Tags auth
// @Accept json
// @Produce json
// @Param body body twoFactorLoginInput true "Temp token e código"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /auth/2fa/login [post]
func (h *Handler) login2FA(w http.ResponseWriter, r *http.Request) {
	var in twoFactorLoginInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_BODY", "corpo inválido")
		return
	}
	if in.TempToken == "" || in.Code == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_FIELDS", "temp_token e código são obrigatórios")
		return
	}

	result, err := h.svc.LoginWith2FA(r.Context(), in.TempToken, in.Code)
	if err != nil {
		httputil.Err(w, http.StatusUnauthorized, "INVALID_CODE", "código inválido")
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
	result, err := h.svc.Refresh(r.Context(), in.RefreshToken)
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
	h.svc.Logout(r.Context(), in.RefreshToken)
	httputil.OK(w, map[string]bool{"logged_out": true})
}

type twoFactorSetupInput struct {
	Email string `json:"email"`
}

type twoFactorVerifyInput struct {
	Code string `json:"code"`
}

type twoFactorDisableInput struct {
	Password string `json:"password"`
}

// @Summary Configurar 2FA
// @Tags auth
// @Accept json
// @Produce json
// @Param body body twoFactorSetupInput true "Email"
// @Success 200 {object} map[string]interface{}
// @Router /auth/2fa/setup [post]
func (h *Handler) setup2FA(w http.ResponseWriter, r *http.Request) {
	var in twoFactorSetupInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Email == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_EMAIL", "email é obrigatório")
		return
	}

	setup, err := h.svc.Setup2FAByEmail(r.Context(), in.Email)
	if err != nil {
		httputil.Err(w, http.StatusInternalServerError, "2FA_SETUP_FAILED", "falha ao configurar 2FA")
		return
	}
	httputil.OK(w, setup)
}

// @Summary Verificar e ativar 2FA
// @Tags auth
// @Accept json
// @Produce json
// @Param body body twoFactorVerifyInput true "Código TOTP"
// @Success 200 {object} map[string]interface{}
// @Router /auth/2fa/verify [post]
func (h *Handler) verify2FA(w http.ResponseWriter, r *http.Request) {
	var in twoFactorVerifyInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Code == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_CODE", "código é obrigatório")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
		return
	}

	err := h.svc.VerifyAndEnable2FA(r.Context(), ownerID, in.Code)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "INVALID_CODE", "código inválido")
		return
	}
	httputil.OK(w, map[string]bool{"two_factor_enabled": true})
}

// @Summary Desativar 2FA
// @Tags auth
// @Accept json
// @Produce json
// @Param body body twoFactorDisableInput true "Senha"
// @Success 200 {object} map[string]interface{}
// @Router /auth/2fa/disable [post]
func (h *Handler) disable2FA(w http.ResponseWriter, r *http.Request) {
	var in twoFactorDisableInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil || in.Password == "" {
		httputil.Err(w, http.StatusBadRequest, "MISSING_PASSWORD", "senha é obrigatória")
		return
	}

	ownerID := auth.OwnerIDFromCtx(r.Context())
	if ownerID == uuid.Nil {
		httputil.Err(w, http.StatusUnauthorized, "UNAUTHORIZED", "não autorizado")
		return
	}

	err := h.svc.Disable2FA(r.Context(), ownerID, in.Password)
	if err != nil {
		httputil.Err(w, http.StatusBadRequest, "DISABLE_2FA_FAILED", err.Error())
		return
	}
	httputil.OK(w, map[string]bool{"two_factor_enabled": false})
}

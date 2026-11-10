package identity_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/FuLygon/go-totp/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// validCode acha o código TOTP de agora para o segredo (a biblioteca só expõe a validação).
func validCode(t *testing.T, secret string) string {
	t.Helper()
	v := totp.Validator{Algorithm: totp.AlgorithmSHA1, Digits: 6, Skew: 1, Period: 30, Secret: secret}
	for i := 0; i < 1_000_000; i++ {
		c := fmt.Sprintf("%06d", i)
		if ok, _ := v.Validate(c); ok {
			return c
		}
	}
	t.Fatal("nenhum código TOTP válido")
	return ""
}

func secretOf(t *testing.T, repo *mock2FARepo, id uuid.UUID) string {
	t.Helper()
	u := repo.users[id]
	require.NotNil(t, u)
	return u.TotpSecret
}

func newSecurityService(t *testing.T) (*identity.Service, *mock2FARepo) {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	repo := newMock2FARepo()
	return identity.NewService(repo, auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)), repo
}

func TestService_Setup2FA_FicaPendenteEDesativado(t *testing.T) {
	svc, repo := newSecurityService(t)
	user, _ := svc.Register(context.Background(), "pendente@test.com", "senha123")

	setup, err := svc.Setup2FA(context.Background(), user.GetUserID())
	require.NoError(t, err)
	assert.NotEmpty(t, setup.Secret)
	assert.Contains(t, setup.QRCodeURL, "otpauth://")
	assert.Contains(t, setup.QRCodeURL, "pendente@test.com", "o e-mail vem do usuário, não de quem chama")

	u := repo.users[user.GetUserID()]
	assert.False(t, u.TwoFactorEnabled, "só ativa depois da confirmação")
	assert.Equal(t, setup.Secret, u.TotpSecret)

	// Setup abandonado: o login continua só com a senha.
	res, err := svc.Login(context.Background(), "pendente@test.com", "senha123")
	require.NoError(t, err)
	assert.False(t, res.TwoFactorRequired)
	assert.NotEmpty(t, res.AccessToken)
}

func TestService_Setup2FA_JaAtivoNaoTrocaOSegredo(t *testing.T) {
	svc, repo := newSecurityService(t)
	user, _ := svc.Register(context.Background(), "ativo@test.com", "senha123")
	id := user.GetUserID()
	_, err := svc.Setup2FA(context.Background(), id)
	require.NoError(t, err)
	_, err = svc.VerifyAndEnable2FA(context.Background(), id, validCode(t, secretOf(t, repo, id)))
	require.NoError(t, err)
	before := secretOf(t, repo, id)

	_, err = svc.Setup2FA(context.Background(), id)
	assert.ErrorIs(t, err, identity.ErrTwoFactorAlreadyEnabled)
	assert.Equal(t, before, secretOf(t, repo, id))
	assert.True(t, repo.users[id].TwoFactorEnabled)
}

func TestService_Verify2FA_AtivaEDevolveCodigosDeRecuperacao(t *testing.T) {
	svc, repo := newSecurityService(t)
	user, _ := svc.Register(context.Background(), "verify@test.com", "senha123")
	id := user.GetUserID()
	_, err := svc.Setup2FA(context.Background(), id)
	require.NoError(t, err)

	codes, err := svc.VerifyAndEnable2FA(context.Background(), id, validCode(t, secretOf(t, repo, id)))
	require.NoError(t, err)
	assert.True(t, repo.users[id].TwoFactorEnabled)
	require.Len(t, codes, 10)
	seen := map[string]bool{}
	for _, c := range codes {
		assert.Regexp(t, regexp.MustCompile(`^\d{10}$`), c, "10 dígitos")
		seen[c] = true
	}
	assert.Len(t, seen, 10, "sem repetidos")
	assert.ElementsMatch(t, codes, repo.users[id].BackupCodes)

	res, err := svc.Login(context.Background(), "verify@test.com", "senha123")
	require.NoError(t, err)
	assert.True(t, res.TwoFactorRequired, "agora o login pede o código")
}

func TestService_Verify2FA_CodigoErradoOuSemSetup(t *testing.T) {
	svc, repo := newSecurityService(t)
	user, _ := svc.Register(context.Background(), "errado@test.com", "senha123")
	id := user.GetUserID()

	_, err := svc.VerifyAndEnable2FA(context.Background(), id, "123456")
	assert.ErrorIs(t, err, identity.ErrTwoFactorNotConfigured)

	_, err = svc.Setup2FA(context.Background(), id)
	require.NoError(t, err)
	good := validCode(t, secretOf(t, repo, id))
	wrong := "000000"
	if good == wrong {
		wrong = "111111"
	}
	_, err = svc.VerifyAndEnable2FA(context.Background(), id, wrong)
	assert.ErrorIs(t, err, identity.ErrInvalidTwoFactorCode)
	assert.False(t, repo.users[id].TwoFactorEnabled)
}

func TestService_ChangePassword(t *testing.T) {
	svc, _ := newSecurityService(t)
	user, _ := svc.Register(context.Background(), "senha@test.com", "senha123")
	id := user.GetUserID()
	ctx := context.Background()

	assert.ErrorIs(t, svc.ChangePassword(ctx, id, "errada123", "novasenha1"), identity.ErrInvalidPassword)
	assert.ErrorIs(t, svc.ChangePassword(ctx, id, "senha123", "curta"), identity.ErrWeakPassword)
	assert.ErrorIs(t, svc.ChangePassword(ctx, id, "senha123", "senha123"), identity.ErrSamePassword)

	require.NoError(t, svc.ChangePassword(ctx, id, "senha123", "novasenha1"))
	_, err := svc.Login(ctx, "senha@test.com", "senha123")
	assert.Error(t, err, "a antiga deixa de valer")
	_, err = svc.Login(ctx, "senha@test.com", "novasenha1")
	assert.NoError(t, err)
}

// ---------- HTTP ----------

func secRouter(t *testing.T) (http.Handler, *identity.Service, *mock2FARepo) {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	repo := newMock2FARepo()
	svc := identity.NewService(repo, jwtSvc)
	h := identity.NewHandler(svc)
	r := chi.NewRouter()
	h.Register(r)
	h.RegisterProtected(r, auth.Middleware(jwtSvc))
	return r, svc, repo
}

func call(h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

type env struct {
	Data  map[string]any `json:"data"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

func decodeEnv(t *testing.T, rr *httptest.ResponseRecorder) env {
	t.Helper()
	var e env
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &e), rr.Body.String())
	return e
}

func TestHandler_Setup2FA_IgnoraOEmailDoCorpo(t *testing.T) {
	h, svc, repo := secRouter(t)
	attacker, _ := svc.Register(context.Background(), "atacante@test.com", "senha123")
	victim, _ := svc.Register(context.Background(), "vitima@test.com", "senha123")

	rr := call(h, http.MethodPost, "/auth/2fa/setup", attacker.AccessToken, map[string]string{"email": "vitima@test.com"})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	assert.Contains(t, decodeEnv(t, rr).Data["qr_code_url"], "atacante@test.com")

	v := repo.users[victim.GetUserID()]
	assert.Empty(t, v.TotpSecret, "a conta da vítima não é tocada")
	assert.False(t, v.TwoFactorEnabled)
	assert.NotEmpty(t, repo.users[attacker.GetUserID()].TotpSecret)
}

func TestHandler_Setup2FA_ExigeLoginEJaAtivo(t *testing.T) {
	h, svc, repo := secRouter(t)
	assert.Equal(t, http.StatusUnauthorized, call(h, http.MethodPost, "/auth/2fa/setup", "", nil).Code)

	user, _ := svc.Register(context.Background(), "dup@test.com", "senha123")
	id := user.GetUserID()
	require.Equal(t, http.StatusOK, call(h, http.MethodPost, "/auth/2fa/setup", user.AccessToken, nil).Code)
	_, err := svc.VerifyAndEnable2FA(context.Background(), id, validCode(t, secretOf(t, repo, id)))
	require.NoError(t, err)

	rr := call(h, http.MethodPost, "/auth/2fa/setup", user.AccessToken, nil)
	assert.Equal(t, http.StatusConflict, rr.Code)
	assert.Equal(t, "ALREADY_ENABLED", decodeEnv(t, rr).Error.Code)
}

func TestHandler_Verify2FA_DevolveCodigos(t *testing.T) {
	h, svc, repo := secRouter(t)
	user, _ := svc.Register(context.Background(), "v@test.com", "senha123")
	id := user.GetUserID()

	rr := call(h, http.MethodPost, "/auth/2fa/verify", user.AccessToken, map[string]string{"code": "123456"})
	assert.Equal(t, http.StatusConflict, rr.Code)
	assert.Equal(t, "NOT_CONFIGURED", decodeEnv(t, rr).Error.Code)

	require.Equal(t, http.StatusOK, call(h, http.MethodPost, "/auth/2fa/setup", user.AccessToken, nil).Code)
	good := validCode(t, secretOf(t, repo, id))
	wrong := "000000"
	if good == wrong {
		wrong = "111111"
	}
	rr = call(h, http.MethodPost, "/auth/2fa/verify", user.AccessToken, map[string]string{"code": wrong})
	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Equal(t, "INVALID_CODE", decodeEnv(t, rr).Error.Code)

	rr = call(h, http.MethodPost, "/auth/2fa/verify", user.AccessToken, map[string]string{"code": good})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	d := decodeEnv(t, rr).Data
	assert.Equal(t, true, d["two_factor_enabled"])
	assert.Len(t, d["backup_codes"], 10)
}

func TestHandler_ChangePassword(t *testing.T) {
	h, svc, _ := secRouter(t)
	user, _ := svc.Register(context.Background(), "troca@test.com", "senha123")

	assert.Equal(t, http.StatusUnauthorized, call(h, http.MethodPost, "/auth/password", "", map[string]string{"current_password": "a", "new_password": "b"}).Code)

	cases := []struct {
		cur, next, code string
		status          int
	}{
		{"errada123", "novasenha1", "INVALID_PASSWORD", http.StatusBadRequest},
		{"senha123", "curta", "WEAK_PASSWORD", http.StatusBadRequest},
		{"senha123", "senha123", "SAME_PASSWORD", http.StatusBadRequest},
	}
	for _, c := range cases {
		rr := call(h, http.MethodPost, "/auth/password", user.AccessToken, map[string]string{"current_password": c.cur, "new_password": c.next})
		assert.Equal(t, c.status, rr.Code, c.code)
		assert.Equal(t, c.code, decodeEnv(t, rr).Error.Code)
	}

	rr := call(h, http.MethodPost, "/auth/password", user.AccessToken, map[string]string{"current_password": "senha123", "new_password": "novasenha1"})
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	_, err := svc.Login(context.Background(), "troca@test.com", "novasenha1")
	assert.NoError(t, err)
}

func TestHandler_Profile_TrazEmailEEstadoDo2FA(t *testing.T) {
	h, svc, _ := secRouter(t)
	user, _ := svc.Register(context.Background(), "perfil@test.com", "senha123")

	rr := call(h, http.MethodGet, "/auth/profile", user.AccessToken, nil)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())
	d := decodeEnv(t, rr).Data
	assert.Equal(t, "perfil@test.com", d["email"])
	assert.Equal(t, false, d["two_factor_enabled"])
	assert.NotContains(t, rr.Body.String(), "totp_secret")
	assert.NotContains(t, rr.Body.String(), "backup_codes")
}

// Regressão: verifyTOTP ignorava o booleano de Validate e aceitava qualquer código de 6 dígitos (inclusive no login).
func TestService_LoginWith2FA_CodigoErradoNaoEntra(t *testing.T) {
	svc, repo := newSecurityService(t)
	user, _ := svc.Register(context.Background(), "login2fa@test.com", "senha123")
	id := user.GetUserID()
	_, err := svc.Setup2FA(context.Background(), id)
	require.NoError(t, err)
	good := validCode(t, secretOf(t, repo, id))
	_, err = svc.VerifyAndEnable2FA(context.Background(), id, good)
	require.NoError(t, err)

	first, err := svc.Login(context.Background(), "login2fa@test.com", "senha123")
	require.NoError(t, err)
	require.True(t, first.TwoFactorRequired)

	for _, wrong := range []string{"000000", "123456", "999999"} {
		if wrong == good {
			continue
		}
		_, err := svc.LoginWith2FA(context.Background(), first.TempToken, wrong)
		assert.Error(t, err, "código %s não pode entrar", wrong)
	}
	res, err := svc.LoginWith2FA(context.Background(), first.TempToken, good)
	require.NoError(t, err)
	assert.NotEmpty(t, res.AccessToken)
}

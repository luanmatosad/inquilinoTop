package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"fmt"
	"io"
	"time"

	"github.com/FuLygon/go-totp/v2"
	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"golang.org/x/crypto/bcrypt"
)

type AuthResult struct {
	User               *User  `json:"user"`
	AccessToken       string `json:"access_token"`
	RefreshToken      string `json:"refresh_token"`
	TwoFactorRequired bool   `json:"two_factor_required,omitempty"`
	TempToken         string `json:"temp_token,omitempty"`
}

func (a *AuthResult) GetUserID() uuid.UUID {
	return a.User.ID
}

type Service struct {
	repo   Repository
	jwtSvc *auth.JWTService
}

func NewService(repo Repository, jwtSvc *auth.JWTService) *Service {
	return &Service{repo: repo, jwtSvc: jwtSvc}
}

func (s *Service) Register(ctx context.Context, email, password string) (*AuthResult, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: hash password: %w", err)
	}
	user, err := s.repo.CreateUser(ctx, email, string(hash))
	if err != nil {
		return nil, fmt.Errorf("identity.svc: create user: %w", err)
	}
	return s.issueTokens(ctx, user)
}

func (s *Service) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	s.repo.CleanupExpiredTempTokens(ctx)

	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: credenciais inválidas")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("identity.svc: credenciais inválidas")
	}
	if user.TwoFactorEnabled {
		tempToken := uuid.New().String()
		err := s.repo.StoreTempToken(ctx, user.ID, tempToken)
		if err != nil {
			return nil, fmt.Errorf("identity.svc: store temp token: %w", err)
		}
		return &AuthResult{
			User:               user,
			TwoFactorRequired: true,
			TempToken:        tempToken,
		}, nil
	}
	return s.issueTokens(ctx, user)
}

func (s *Service) LoginWith2FA(ctx context.Context, tempToken, code string) (*AuthResult, error) {
	userID, err := s.repo.GetTempTokenUser(ctx, tempToken)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: temp token inválido")
	}

	user, err := s.repo.GetUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: get user: %w", err)
	}

	valid := verifyTOTP(user.TotpSecret, code)
	if !valid {
		valid, _ = s.repo.UseBackupCode(ctx, userID, code)
	}

	if !valid {
		return nil, fmt.Errorf("identity.svc: código inválido")
	}

	err = s.repo.InvalidateTempToken(ctx, tempToken)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: invalidate temp: %w", err)
	}

	return s.issueTokens(ctx, user)
}

func (s *Service) Refresh(ctx context.Context, rawRefreshToken string) (*AuthResult, error) {
	hash := tokenHash(rawRefreshToken)
	rt, err := s.repo.GetRefreshToken(ctx, hash)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: refresh token inválido")
	}
	if rt.RevokedAt != nil || time.Now().After(rt.ExpiresAt) {
		return nil, fmt.Errorf("identity.svc: refresh token expirado ou revogado")
	}
	if err := s.repo.RevokeRefreshToken(ctx, hash); err != nil {
		return nil, fmt.Errorf("identity.svc: revogar token: %w", err)
	}
	user, err := s.repo.GetUserByID(ctx, rt.UserID)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: usuário não encontrado: %w", err)
	}
	return s.issueTokens(ctx, user)
}

func (s *Service) Logout(ctx context.Context, rawRefreshToken string) error {
	return s.repo.RevokeRefreshToken(ctx, tokenHash(rawRefreshToken))
}

func (s *Service) issueTokens(ctx context.Context, user *User) (*AuthResult, error) {
	accessToken, err := s.jwtSvc.Sign(user.ID)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: sign access token: %w", err)
	}
	raw := uuid.New().String()
	_, err = s.repo.CreateRefreshToken(ctx, user.ID, tokenHash(raw), time.Now().Add(30*24*time.Hour))
	if err != nil {
		return nil, fmt.Errorf("identity.svc: create refresh token: %w", err)
	}
	return &AuthResult{User: user, AccessToken: accessToken, RefreshToken: raw}, nil
}

func tokenHash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return fmt.Sprintf("%x", sum)
}

func (s *Service) Setup2FAByEmail(ctx context.Context, email string) (*TwoFactorSetup, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: setup 2fa: %w", err)
	}
	return s.Setup2FA(ctx, user.ID, email)
}

func (s *Service) Setup2FA(ctx context.Context, userID uuid.UUID, email string) (*TwoFactorSetup, error) {
	secret := generateSecret()

	t, err := totp.New(totp.TOTP{
		AccountName: email,
		Issuer:     "InquilinoTop",
		Algorithm:  totp.AlgorithmSHA1,
		Digits:     6,
		Period:    30,
		Secret:    secret,
	})
	if err != nil {
		return nil, fmt.Errorf("identity.svc: create totp: %w", err)
	}
	otpAuthURL, err := t.GetURL()
	if err != nil {
		return nil, fmt.Errorf("identity.svc: get url: %w", err)
	}

	err = s.repo.Enable2FA(ctx, userID, secret, nil)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: save temp secret: %w", err)
	}

	return &TwoFactorSetup{
		Secret:    secret,
		QRCodeURL: otpAuthURL,
	}, nil
}

func (s *Service) VerifyAndEnable2FA(ctx context.Context, userID uuid.UUID, code string) error {
	user, err := s.repo.GetUserWith2FA(ctx, userID)
	if err != nil {
		return fmt.Errorf("identity.svc: get user: %w", err)
	}
	if user.TotpSecret == "" {
		return fmt.Errorf("identity.svc: 2fa não configurado")
	}

	valid := verifyTOTP(user.TotpSecret, code)
	backupUsed := false

	if !valid {
		valid, err = s.repo.UseBackupCode(ctx, userID, code)
		if err != nil {
			return fmt.Errorf("identity.svc: verificar backup code: %w", err)
		}
		backupUsed = valid
	}

	if !valid && !backupUsed {
		return fmt.Errorf("identity.svc: código 2fa inválido")
	}

	return s.repo.Enable2FA(ctx, userID, user.TotpSecret, generateBackupCodes(10))
}

func (s *Service) Disable2FA(ctx context.Context, userID uuid.UUID, password string) error {
	user, err := s.repo.GetUserWith2FA(ctx, userID)
	if err != nil {
		return fmt.Errorf("identity.svc: get user: %w", err)
	}
	if !user.TwoFactorEnabled {
		return fmt.Errorf("identity.svc: 2fa não está habilitado")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return fmt.Errorf("identity.svc: senha incorreta")
	}

	return s.repo.Disable2FA(ctx, userID)
}

func (s *Service) Require2FA(ctx context.Context, userID uuid.UUID) (bool, error) {
	user, err := s.repo.GetUserWith2FA(ctx, userID)
	if err != nil {
		return false, fmt.Errorf("identity.svc: get user: %w", err)
	}
	return user.TwoFactorEnabled, nil
}

func generateSecret() string {
	secret := make([]byte, 20)
	if _, err := io.ReadFull(rand.Reader, secret); err != nil {
		panic(fmt.Sprintf("identity: generateSecret: %v", err))
	}
	return base32.StdEncoding.EncodeToString(secret)[:32]
}

func generateBackupCodes(count int) []string {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		code := make([]byte, 4)
		if _, err := io.ReadFull(rand.Reader, code); err != nil {
			panic(fmt.Sprintf("identity: generateBackupCodes: %v", err))
		}
		for j := range code {
			code[j] = byte(int(code[j])%10 + '0')
		}
		codes[i] = string(code)
	}
	return codes
}

func verifyTOTP(secret, code string) bool {
	if len(code) != 6 {
		return false
	}

	v := totp.Validator{
		Algorithm: totp.AlgorithmSHA1,
		Digits:    6,
		Skew:     1,
		Period:   30,
		Secret:   secret,
	}
	_, err := v.Validate(code)
	return err == nil
}

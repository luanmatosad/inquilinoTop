package identity_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	users         map[string]*identity.User
	refreshTokens map[string]*identity.RefreshToken
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		users:         make(map[string]*identity.User),
		refreshTokens: make(map[string]*identity.RefreshToken),
	}
}

func (m *mockRepo) CreateUser(_ context.Context, email, passwordHash string) (*identity.User, error) {
	if _, exists := m.users[email]; exists {
		return nil, errors.New("email já cadastrado")
	}
	u := &identity.User{ID: uuid.New(), Email: email, PasswordHash: passwordHash, Plan: "FREE"}
	m.users[email] = u
	return u, nil
}

func (m *mockRepo) GetUserByEmail(_ context.Context, email string) (*identity.User, error) {
	u, ok := m.users[email]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (m *mockRepo) GetUserByID(_ context.Context, id uuid.UUID) (*identity.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockRepo) CreateRefreshToken(_ context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*identity.RefreshToken, error) {
	rt := &identity.RefreshToken{ID: uuid.New(), UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt}
	m.refreshTokens[tokenHash] = rt
	return rt, nil
}

func (m *mockRepo) GetRefreshToken(_ context.Context, tokenHash string) (*identity.RefreshToken, error) {
	rt, ok := m.refreshTokens[tokenHash]
	if !ok {
		return nil, errors.New("not found")
	}
	return rt, nil
}

func (m *mockRepo) RevokeRefreshToken(_ context.Context, tokenHash string) error {
	rt, ok := m.refreshTokens[tokenHash]
	if !ok {
		return errors.New("not found")
	}
	now := time.Now()
	rt.RevokedAt = &now
	return nil
}

func (m *mockRepo) Enable2FA(_ context.Context, userID uuid.UUID, secret string, backupCodes []string) error {
	for _, u := range m.users {
		if u.ID == userID {
			u.TotpSecret = secret
			u.BackupCodes = backupCodes
			u.TwoFactorEnabled = true
			return nil
		}
	}
	return nil
}

func (m *mockRepo) Disable2FA(_ context.Context, userID uuid.UUID) error {
	for _, u := range m.users {
		if u.ID == userID {
			u.TotpSecret = ""
			u.BackupCodes = nil
			u.TwoFactorEnabled = false
			return nil
		}
	}
	return nil
}

func (m *mockRepo) GetUserWith2FA(_ context.Context, userID uuid.UUID) (*identity.User, error) {
	for _, u := range m.users {
		if u.ID == userID {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) GetUser(_ context.Context, userID uuid.UUID) (*identity.User, error) {
	for _, u := range m.users {
		if u.ID == userID {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) UseBackupCode(_ context.Context, userID uuid.UUID, code string) (bool, error) {
	return false, nil
}

func (m *mockRepo) StoreTempToken(_ context.Context, userID uuid.UUID, token string) error {
	return nil
}

func (m *mockRepo) GetTempTokenUser(_ context.Context, token string) (uuid.UUID, error) {
	return uuid.Nil, nil
}

func (m *mockRepo) InvalidateTempToken(_ context.Context, token string) error {
	return nil
}

func (m *mockRepo) CleanupExpiredTempTokens(_ context.Context) (int64, error) {
	return 0, nil
}

func newTestService(t *testing.T) *identity.Service {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	return identity.NewService(newMockRepo(), jwtSvc)
}

func TestService_Register(t *testing.T) {
	svc := newTestService(t)
	result, err := svc.Register(context.Background(), "user@test.com", "senha123")
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
	assert.NotEmpty(t, result.RefreshToken)
	assert.NotEmpty(t, result.User.ID)
}

func TestService_Register_DuplicateEmail(t *testing.T) {
	svc := newTestService(t)
	svc.Register(context.Background(), "dup@test.com", "senha123")
	_, err := svc.Register(context.Background(), "dup@test.com", "outrasenha")
	assert.Error(t, err)
}

func TestService_Login(t *testing.T) {
	svc := newTestService(t)
	svc.Register(context.Background(), "login@test.com", "minhasenha")
	result, err := svc.Login(context.Background(), "login@test.com", "minhasenha")
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
}

func TestService_Login_WrongPassword(t *testing.T) {
	svc := newTestService(t)
	svc.Register(context.Background(), "wp@test.com", "correta")
	_, err := svc.Login(context.Background(), "wp@test.com", "errada")
	assert.Error(t, err)
}

func TestService_Refresh(t *testing.T) {
	svc := newTestService(t)
	reg, _ := svc.Register(context.Background(), "refresh@test.com", "senha123")
	result, err := svc.Refresh(context.Background(), reg.RefreshToken)
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
}

func TestService_Logout(t *testing.T) {
	svc := newTestService(t)
	reg, _ := svc.Register(context.Background(), "logout@test.com", "senha123")

	err := svc.Logout(context.Background(), reg.RefreshToken)
	require.NoError(t, err)
}

func TestService_Login_UserNotFound(t *testing.T) {
	svc := newTestService(t)
	_, err := svc.Login(context.Background(), "naoexiste@test.com", "senha")
	assert.Error(t, err)
}

func TestService_Refresh_ExpiredToken(t *testing.T) {
	svc := newTestService(t)
	_, _ = svc.Register(context.Background(), "expired@test.com", "senha123")

	_, err := svc.Refresh(context.Background(), "token-inexistente")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "inválido")
}

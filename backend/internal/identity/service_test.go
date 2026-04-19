package identity_test

import (
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

func (m *mockRepo) CreateUser(email, passwordHash string) (*identity.User, error) {
	if _, exists := m.users[email]; exists {
		return nil, errors.New("email já cadastrado")
	}
	u := &identity.User{ID: uuid.New(), Email: email, PasswordHash: passwordHash, Plan: "FREE"}
	m.users[email] = u
	return u, nil
}

func (m *mockRepo) GetUserByEmail(email string) (*identity.User, error) {
	u, ok := m.users[email]
	if !ok {
		return nil, errors.New("not found")
	}
	return u, nil
}

func (m *mockRepo) GetUserByID(id uuid.UUID) (*identity.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}

func (m *mockRepo) CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) (*identity.RefreshToken, error) {
	rt := &identity.RefreshToken{ID: uuid.New(), UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt}
	m.refreshTokens[tokenHash] = rt
	return rt, nil
}

func (m *mockRepo) GetRefreshToken(tokenHash string) (*identity.RefreshToken, error) {
	rt, ok := m.refreshTokens[tokenHash]
	if !ok {
		return nil, errors.New("not found")
	}
	return rt, nil
}

func (m *mockRepo) RevokeRefreshToken(tokenHash string) error {
	rt, ok := m.refreshTokens[tokenHash]
	if !ok {
		return errors.New("not found")
	}
	now := time.Now()
	rt.RevokedAt = &now
	return nil
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
	result, err := svc.Register("user@test.com", "senha123")
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
	assert.NotEmpty(t, result.RefreshToken)
	assert.NotEmpty(t, result.User.ID)
}

func TestService_Register_DuplicateEmail(t *testing.T) {
	svc := newTestService(t)
	svc.Register("dup@test.com", "senha123")
	_, err := svc.Register("dup@test.com", "outrasenha")
	assert.Error(t, err)
}

func TestService_Login(t *testing.T) {
	svc := newTestService(t)
	svc.Register("login@test.com", "minhasenha")
	result, err := svc.Login("login@test.com", "minhasenha")
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
}

func TestService_Login_WrongPassword(t *testing.T) {
	svc := newTestService(t)
	svc.Register("wp@test.com", "correta")
	_, err := svc.Login("wp@test.com", "errada")
	assert.Error(t, err)
}

func TestService_Refresh(t *testing.T) {
	svc := newTestService(t)
	reg, _ := svc.Register("refresh@test.com", "senha")
	result, err := svc.Refresh(reg.RefreshToken)
	require.NoError(t, err)
	assert.NotEmpty(t, result.AccessToken)
}

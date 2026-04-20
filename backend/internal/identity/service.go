package identity

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/auth"
	"golang.org/x/crypto/bcrypt"
)

type AuthResult struct {
	User         *User  `json:"user"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
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
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("identity.svc: credenciais inválidas")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("identity.svc: credenciais inválidas")
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

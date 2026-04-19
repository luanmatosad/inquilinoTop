package identity

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
)

type pgRepository struct {
	db *db.DB
}

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) CreateUser(email, passwordHash string) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, password_hash, plan, created_at, updated_at`,
		email, passwordHash,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: create user: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserByEmail(email string) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, email, password_hash, plan, created_at, updated_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by email: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserByID(id uuid.UUID) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, email, password_hash, plan, created_at, updated_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by id: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) CreateRefreshToken(userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.Pool.QueryRow(context.Background(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at`,
		userID, tokenHash, expiresAt,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: create refresh token: %w", err)
	}
	return &rt, nil
}

func (r *pgRepository) GetRefreshToken(tokenHash string) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.Pool.QueryRow(context.Background(),
		`SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get refresh token: %w", err)
	}
	return &rt, nil
}

func (r *pgRepository) RevokeRefreshToken(tokenHash string) error {
	now := time.Now()
	_, err := r.db.Pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2`,
		now, tokenHash,
	)
	if err != nil {
		return fmt.Errorf("identity.repo: revoke refresh token: %w", err)
	}
	return nil
}

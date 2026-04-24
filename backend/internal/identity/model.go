package identity

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID               uuid.UUID  `json:"id"`
	Email            string    `json:"email"`
	PasswordHash    string    `json:"-"`
	Plan             string    `json:"plan"`
	TotpSecret      string    `json:"totp_secret,omitempty"`
	BackupCodes     []string  `json:"backup_codes,omitempty"`
	TwoFactorEnabled bool    `json:"two_factor_enabled"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type RefreshToken struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	TokenHash string     `json:"-"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Repository interface {
	CreateUser(ctx context.Context, email, passwordHash string) (*User, error)
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetUser(ctx context.Context, id uuid.UUID) (*User, error)
	CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error)
	GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error)
	RevokeRefreshToken(ctx context.Context, tokenHash string) error
	Enable2FA(ctx context.Context, userID uuid.UUID, secret string, backupCodes []string) error
	Disable2FA(ctx context.Context, userID uuid.UUID) error
	GetUserWith2FA(ctx context.Context, userID uuid.UUID) (*User, error)
	UseBackupCode(ctx context.Context, userID uuid.UUID, code string) (bool, error)
	StoreTempToken(ctx context.Context, userID uuid.UUID, token string) error
	GetTempTokenUser(ctx context.Context, token string) (uuid.UUID, error)
	InvalidateTempToken(ctx context.Context, token string) error
	CleanupExpiredTempTokens(ctx context.Context) (int64, error)
}

type TwoFactorSetup struct {
	Secret       string `json:"secret"`
	QRCodeURL    string `json:"qr_code_url"`
	BackupCodes []string `json:"backup_codes"`
}

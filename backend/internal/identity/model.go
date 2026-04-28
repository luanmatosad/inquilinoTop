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

type UserProfile struct {
	UserID      uuid.UUID `json:"user_id"`
	FullName    *string   `json:"full_name,omitempty"`
	Document    *string   `json:"document,omitempty"`
	PersonType  *string   `json:"person_type,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	AddressLine *string   `json:"address_line,omitempty"`
	City        *string   `json:"city,omitempty"`
	State       *string   `json:"state,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type UpsertProfileInput struct {
	FullName    *string `json:"full_name,omitempty" validate:"omitempty,max=255"`
	Document    *string `json:"document,omitempty" validate:"omitempty,max=20"`
	PersonType  *string `json:"person_type,omitempty" validate:"omitempty,oneof=PF PJ"`
	Phone       *string `json:"phone,omitempty" validate:"omitempty,max=20"`
	AddressLine *string `json:"address_line,omitempty" validate:"omitempty,max=500"`
	City        *string `json:"city,omitempty" validate:"omitempty,max=100"`
	State       *string `json:"state,omitempty" validate:"omitempty,max=2"`
}

type NotificationPreferences struct {
	UserID                   uuid.UUID `json:"user_id"`
	NotifyPaymentOverdue     bool      `json:"notify_payment_overdue"`
	NotifyLeaseExpiring      bool      `json:"notify_lease_expiring"`
	NotifyLeaseExpiringDays  int       `json:"notify_lease_expiring_days"`
	NotifyNewMessage         bool      `json:"notify_new_message"`
	NotifyMaintenanceRequest bool      `json:"notify_maintenance_request"`
	NotifyPaymentReceived    bool      `json:"notify_payment_received"`
	CreatedAt                time.Time `json:"created_at"`
	UpdatedAt                time.Time `json:"updated_at"`
}

type UpsertNotificationPreferencesInput struct {
	NotifyPaymentOverdue     bool `json:"notify_payment_overdue"`
	NotifyLeaseExpiring      bool `json:"notify_lease_expiring"`
	NotifyLeaseExpiringDays  int  `json:"notify_lease_expiring_days" validate:"min=1,max=365"`
	NotifyNewMessage         bool `json:"notify_new_message"`
	NotifyMaintenanceRequest bool `json:"notify_maintenance_request"`
	NotifyPaymentReceived    bool `json:"notify_payment_received"`
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
	GetProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error)
	UpsertProfile(ctx context.Context, userID uuid.UUID, in UpsertProfileInput) (*UserProfile, error)
	GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error)
	UpsertNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error)
}

type TwoFactorSetup struct {
	Secret       string `json:"secret"`
	QRCodeURL    string `json:"qr_code_url"`
	BackupCodes []string `json:"backup_codes"`
}

type AuditLogger interface {
	LogLogin(ctx context.Context, userID uuid.UUID)
	LogLogout(ctx context.Context, userID uuid.UUID)
	LogFailedLogin(ctx context.Context)
}

type NoopAuditLogger struct{}

func (n *NoopAuditLogger) LogLogin(_ context.Context, _ uuid.UUID)  {}
func (n *NoopAuditLogger) LogLogout(_ context.Context, _ uuid.UUID) {}
func (n *NoopAuditLogger) LogFailedLogin(_ context.Context)         {}

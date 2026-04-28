package identity

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/jackc/pgx/v5"
)

type pgRepository struct {
	db *db.DB
}

func NewRepository(database *db.DB) Repository {
	return &pgRepository{db: database}
}

func (r *pgRepository) CreateUser(ctx context.Context, email, passwordHash string) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2)
		 RETURNING id, email, password_hash, plan, COALESCE(totp_secret, ''), COALESCE(backup_codes, '{}'), two_factor_enabled, created_at, updated_at`,
		email, passwordHash,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.TotpSecret, &u.BackupCodes, &u.TwoFactorEnabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: create user: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, plan, COALESCE(totp_secret, ''), COALESCE(backup_codes, '{}'), two_factor_enabled, created_at, updated_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.TotpSecret, &u.BackupCodes, &u.TwoFactorEnabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by email: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, plan, COALESCE(totp_secret, ''), COALESCE(backup_codes, '{}'), two_factor_enabled, created_at, updated_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.TotpSecret, &u.BackupCodes, &u.TwoFactorEnabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user by id: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.Pool.QueryRow(ctx,
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

func (r *pgRepository) GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, user_id, token_hash, expires_at, revoked_at, created_at
		 FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash,
	).Scan(&rt.ID, &rt.UserID, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get refresh token: %w", err)
	}
	return &rt, nil
}

func (r *pgRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	now := time.Now()
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = $1 WHERE token_hash = $2`,
		now, tokenHash,
	)
	if err != nil {
		return fmt.Errorf("identity.repo: revoke refresh token: %w", err)
	}
	return nil
}

func (r *pgRepository) Enable2FA(ctx context.Context, userID uuid.UUID, secret string, backupCodes []string) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE users SET totp_secret = $1, backup_codes = $2, two_factor_enabled = true WHERE id = $3`,
		secret, backupCodes, userID,
	)
	if err != nil {
		return fmt.Errorf("identity.repo: enable 2fa: %w", err)
	}
	return nil
}

func (r *pgRepository) Disable2FA(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx,
		`UPDATE users SET totp_secret = NULL, backup_codes = NULL, two_factor_enabled = false WHERE id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("identity.repo: disable 2fa: %w", err)
	}
	return nil
}

func (r *pgRepository) GetUser(ctx context.Context, id uuid.UUID) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, plan, COALESCE(totp_secret, ''), COALESCE(backup_codes, '{}'), two_factor_enabled, created_at, updated_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.TotpSecret, &u.BackupCodes, &u.TwoFactorEnabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) GetUserWith2FA(ctx context.Context, userID uuid.UUID) (*User, error) {
	var u User
	err := r.db.Pool.QueryRow(ctx,
		`SELECT id, email, password_hash, plan, COALESCE(totp_secret, ''), COALESCE(backup_codes, '{}'), two_factor_enabled, created_at, updated_at FROM users WHERE id = $1`,
		userID,
	).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Plan, &u.TotpSecret, &u.BackupCodes, &u.TwoFactorEnabled, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: get user with 2fa: %w", err)
	}
	return &u, nil
}

func (r *pgRepository) UseBackupCode(ctx context.Context, userID uuid.UUID, code string) (bool, error) {
	var valid bool
	err := r.db.Pool.QueryRow(ctx,
		`SELECT $1 = ANY(backup_codes) FROM users WHERE id = $2`,
		code, userID,
	).Scan(&valid)
	if err != nil {
		return false, fmt.Errorf("identity.repo: use backup code: %w", err)
	}
	if valid {
		_, err := r.db.Pool.Exec(ctx,
			`UPDATE users SET backup_codes = array_remove(backup_codes, $1) WHERE id = $2`,
			code, userID,
		)
		if err != nil {
			return false, fmt.Errorf("identity.repo: remove used backup code: %w", err)
		}
	}
	return valid, nil
}

func (r *pgRepository) StoreTempToken(ctx context.Context, userID uuid.UUID, token string) error {
	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO temp_2fa_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
		userID, token, time.Now().Add(5*time.Minute),
	)
	if err != nil {
		return fmt.Errorf("identity.repo: store temp token: %w", err)
	}
	return nil
}

func (r *pgRepository) GetTempTokenUser(ctx context.Context, token string) (uuid.UUID, error) {
	var userID uuid.UUID
	var expiresAt time.Time
	err := r.db.Pool.QueryRow(ctx,
		`SELECT user_id, expires_at FROM temp_2fa_tokens WHERE token = $1`,
		token,
	).Scan(&userID, &expiresAt)
	if err != nil {
		return uuid.Nil, fmt.Errorf("identity.repo: temp token not found: %w", err)
	}
	if time.Now().After(expiresAt) {
		return uuid.Nil, fmt.Errorf("identity.repo: temp token expired")
	}
	return userID, nil
}

func (r *pgRepository) InvalidateTempToken(ctx context.Context, token string) error {
	_, err := r.db.Pool.Exec(ctx,
		`DELETE FROM temp_2fa_tokens WHERE token = $1`,
		token,
	)
	return err
}

func (r *pgRepository) CleanupExpiredTempTokens(ctx context.Context) (int64, error) {
	result, err := r.db.Pool.Exec(ctx,
		`DELETE FROM temp_2fa_tokens WHERE expires_at < NOW()`,
	)
	if err != nil {
		return 0, fmt.Errorf("identity.repo: cleanup temp tokens: %w", err)
	}
	return result.RowsAffected(), nil
}

func (r *pgRepository) GetProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error) {
	var p UserProfile
	err := r.db.Pool.QueryRow(ctx,
		`SELECT user_id, full_name, document, person_type, phone, address_line, city, state, created_at, updated_at
		 FROM user_profiles WHERE user_id = $1`,
		userID,
	).Scan(&p.UserID, &p.FullName, &p.Document, &p.PersonType, &p.Phone, &p.AddressLine, &p.City, &p.State, &p.CreatedAt, &p.UpdatedAt)
	
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("identity.repo: get profile: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) UpsertProfile(ctx context.Context, userID uuid.UUID, in UpsertProfileInput) (*UserProfile, error) {
	var p UserProfile
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO user_profiles (user_id, full_name, document, person_type, phone, address_line, city, state, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		 	full_name = EXCLUDED.full_name,
		 	document = EXCLUDED.document,
		 	person_type = EXCLUDED.person_type,
		 	phone = EXCLUDED.phone,
		 	address_line = EXCLUDED.address_line,
		 	city = EXCLUDED.city,
		 	state = EXCLUDED.state,
		 	updated_at = NOW()
		 RETURNING user_id, full_name, document, person_type, phone, address_line, city, state, created_at, updated_at`,
		userID, in.FullName, in.Document, in.PersonType, in.Phone, in.AddressLine, in.City, in.State,
	).Scan(&p.UserID, &p.FullName, &p.Document, &p.PersonType, &p.Phone, &p.AddressLine, &p.City, &p.State, &p.CreatedAt, &p.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("identity.repo: upsert profile: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	var p NotificationPreferences
	err := r.db.Pool.QueryRow(ctx,
		`SELECT user_id, notify_payment_overdue, notify_lease_expiring, notify_lease_expiring_days,
		        notify_new_message, notify_maintenance_request, notify_payment_received, created_at, updated_at
		 FROM user_notification_preferences WHERE user_id = $1`,
		userID,
	).Scan(
		&p.UserID, &p.NotifyPaymentOverdue, &p.NotifyLeaseExpiring, &p.NotifyLeaseExpiringDays,
		&p.NotifyNewMessage, &p.NotifyMaintenanceRequest, &p.NotifyPaymentReceived,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("identity.repo: get notification preferences: %w", err)
	}
	return &p, nil
}

func (r *pgRepository) UpsertNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error) {
	var p NotificationPreferences
	err := r.db.Pool.QueryRow(ctx,
		`INSERT INTO user_notification_preferences
		 (user_id, notify_payment_overdue, notify_lease_expiring, notify_lease_expiring_days,
		  notify_new_message, notify_maintenance_request, notify_payment_received, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET
		 	notify_payment_overdue     = EXCLUDED.notify_payment_overdue,
		 	notify_lease_expiring      = EXCLUDED.notify_lease_expiring,
		 	notify_lease_expiring_days = EXCLUDED.notify_lease_expiring_days,
		 	notify_new_message         = EXCLUDED.notify_new_message,
		 	notify_maintenance_request = EXCLUDED.notify_maintenance_request,
		 	notify_payment_received    = EXCLUDED.notify_payment_received,
		 	updated_at                 = NOW()
		 RETURNING user_id, notify_payment_overdue, notify_lease_expiring, notify_lease_expiring_days,
		           notify_new_message, notify_maintenance_request, notify_payment_received, created_at, updated_at`,
		userID, in.NotifyPaymentOverdue, in.NotifyLeaseExpiring, in.NotifyLeaseExpiringDays,
		in.NotifyNewMessage, in.NotifyMaintenanceRequest, in.NotifyPaymentReceived,
	).Scan(
		&p.UserID, &p.NotifyPaymentOverdue, &p.NotifyLeaseExpiring, &p.NotifyLeaseExpiringDays,
		&p.NotifyNewMessage, &p.NotifyMaintenanceRequest, &p.NotifyPaymentReceived,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("identity.repo: upsert notification preferences: %w", err)
	}
	return &p, nil
}


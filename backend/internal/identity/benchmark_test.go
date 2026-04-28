package identity

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func BenchmarkBCrypt_GenerateHash(b *testing.B) {
	password := []byte("senha123456")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkBCrypt_GenerateHashCost10(b *testing.B) {
	password := []byte("senha123456")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := bcrypt.GenerateFromPassword(password, 10)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkBCrypt_GenerateHashCost12(b *testing.B) {
	password := []byte("senha123456")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := bcrypt.GenerateFromPassword(password, 12)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkBCrypt_GenerateHashCost14(b *testing.B) {
	password := []byte("senha123456")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := bcrypt.GenerateFromPassword(password, 14)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkBCrypt_CompareHash(b *testing.B) {
	password := []byte("senha123456")
	hash, _ := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := bcrypt.CompareHashAndPassword(hash, password)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkBCrypt_CompareHashParallel(b *testing.B) {
	password := []byte("senha123456")
	hash, _ := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			_ = bcrypt.CompareHashAndPassword(hash, password)
		}
	})
}

type benchRepo struct{}

func (r *benchRepo) CreateUser(ctx context.Context, email, passwordHash string) (*User, error) {
	return &User{ID: uuid.New(), Email: email, PasswordHash: passwordHash}, nil
}

func (r *benchRepo) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	return nil, nil
}

func (r *benchRepo) GetUserByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return nil, nil
}

func (r *benchRepo) GetUser(ctx context.Context, id uuid.UUID) (*User, error) {
	return nil, nil
}

func (r *benchRepo) CreateRefreshToken(ctx context.Context, userID uuid.UUID, tokenHash string, expiresAt time.Time) (*RefreshToken, error) {
	return nil, nil
}

func (r *benchRepo) GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	return nil, nil
}

func (r *benchRepo) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	return nil
}

func (r *benchRepo) GetUserWith2FA(ctx context.Context, userID uuid.UUID) (*User, error) {
	return nil, nil
}

func (r *benchRepo) Enable2FA(ctx context.Context, userID uuid.UUID, secret string, backupCodes []string) error {
	return nil
}

func (r *benchRepo) Disable2FA(ctx context.Context, userID uuid.UUID) error {
	return nil
}

func (r *benchRepo) UseBackupCode(ctx context.Context, userID uuid.UUID, code string) (bool, error) {
	return false, nil
}

func (r *benchRepo) StoreTempToken(ctx context.Context, userID uuid.UUID, token string) error {
	return nil
}

func (r *benchRepo) GetTempTokenUser(ctx context.Context, token string) (uuid.UUID, error) {
	return uuid.Nil, nil
}

func (r *benchRepo) InvalidateTempToken(ctx context.Context, token string) error {
	return nil
}

func (r *benchRepo) CleanupExpiredTempTokens(ctx context.Context) (int64, error) {
	return 0, nil
}

func BenchmarkService_Register(b *testing.B) {
	svc := NewService(&benchRepo{}, nil)

	email := "bench@test.com"
	password := "senha123456"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := svc.Register(context.Background(), email, password)
		if err != nil {
			b.Fatal(err)
		}
	}
}
func (r *benchRepo) GetProfile(ctx context.Context, userID uuid.UUID) (*UserProfile, error) {
	return nil, nil
}

func (r *benchRepo) UpsertProfile(ctx context.Context, userID uuid.UUID, in UpsertProfileInput) (*UserProfile, error) {
	return nil, nil
}

func (r *benchRepo) GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (*NotificationPreferences, error) {
	return nil, nil
}

func (r *benchRepo) UpsertNotificationPreferences(ctx context.Context, userID uuid.UUID, in UpsertNotificationPreferencesInput) (*NotificationPreferences, error) {
	return nil, nil
}

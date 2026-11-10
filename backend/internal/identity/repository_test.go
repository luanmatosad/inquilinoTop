package identity_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/pkg/apierr"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE users, refresh_tokens CASCADE")
		d.Close()
	})
	return d
}

func TestRepository_GetUserByID_WithoutTwoFactor(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, err := repo.CreateUser(context.Background(), "noTfa@test.com", "hash123")
	require.NoError(t, err)
	require.False(t, user.TwoFactorEnabled)

	got, err := repo.GetUserByID(context.Background(), user.ID)
	require.NoError(t, err, "GetUserByID não deve falhar para user sem 2FA configurado")
	assert.Equal(t, user.ID, got.ID)
	assert.Equal(t, "", got.TotpSecret, "TotpSecret deve ser string vazia quando NULL")
}

func TestRepository_CreateRefreshToken(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, _ := repo.CreateUser(context.Background(), "rt@example.com", "hash")
	rt, err := repo.CreateRefreshToken(context.Background(), user.ID, "tokenHash123", time.Now().Add(30*24*time.Hour))
	require.NoError(t, err)
	assert.NotEmpty(t, rt.ID)

	found, err := repo.GetRefreshToken(context.Background(), "tokenHash123")
	require.NoError(t, err)
	assert.Equal(t, user.ID, found.UserID)
}

func TestRepository_RevokeRefreshToken(t *testing.T) {
	database := testDB(t)
	repo := identity.NewRepository(database)

	user, _ := repo.CreateUser(context.Background(), "rev@example.com", "hash")
	repo.CreateRefreshToken(context.Background(), user.ID, "revokeMe", time.Now().Add(time.Hour))

	err := repo.RevokeRefreshToken(context.Background(), "revokeMe")
	require.NoError(t, err)

	rt, _ := repo.GetRefreshToken(context.Background(), "revokeMe")
	assert.NotNil(t, rt.RevokedAt)
}

func TestRepository_CreateUser_EmailDuplicado(t *testing.T) {
	d := testDB(t)
	repo := identity.NewRepository(d)

	_, err := repo.CreateUser(context.Background(), "dup-repo@test.com", "hash")
	require.NoError(t, err)

	_, err = repo.CreateUser(context.Background(), "dup-repo@test.com", "hash")
	require.Error(t, err)
	assert.ErrorIs(t, err, apierr.ErrConflict)
}

func TestRepository_SaveTOTPSecret_FicaPendente(t *testing.T) {
	repo := identity.NewRepository(testDB(t))
	ctx := context.Background()
	user, err := repo.CreateUser(ctx, "pending2fa@test.com", "hash123")
	require.NoError(t, err)

	require.NoError(t, repo.SaveTOTPSecret(ctx, user.ID, "SEGREDOPENDENTE"))
	got, err := repo.GetUserWith2FA(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, "SEGREDOPENDENTE", got.TotpSecret)
	assert.False(t, got.TwoFactorEnabled, "segredo pendente não liga o 2FA")
	assert.Empty(t, got.BackupCodes)

	// A confirmação liga e guarda os códigos; um novo setup volta a pendente e apaga os códigos.
	require.NoError(t, repo.Enable2FA(ctx, user.ID, "SEGREDOPENDENTE", []string{"1111111111"}))
	got, _ = repo.GetUserWith2FA(ctx, user.ID)
	assert.True(t, got.TwoFactorEnabled)
	require.NoError(t, repo.SaveTOTPSecret(ctx, user.ID, "OUTROSEGREDO"))
	got, _ = repo.GetUserWith2FA(ctx, user.ID)
	assert.False(t, got.TwoFactorEnabled)
	assert.Empty(t, got.BackupCodes)
}

func TestRepository_SetPassword(t *testing.T) {
	repo := identity.NewRepository(testDB(t))
	ctx := context.Background()
	user, err := repo.CreateUser(ctx, "setpass@test.com", "hash-antigo")
	require.NoError(t, err)
	other, err := repo.CreateUser(ctx, "outro@test.com", "hash-outro")
	require.NoError(t, err)

	require.NoError(t, repo.SetPassword(ctx, user.ID, "hash-novo"))
	got, _ := repo.GetUserByID(ctx, user.ID)
	assert.Equal(t, "hash-novo", got.PasswordHash)
	untouched, _ := repo.GetUserByID(ctx, other.ID)
	assert.Equal(t, "hash-outro", untouched.PasswordHash, "só o usuário informado muda")
}

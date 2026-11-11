package identity_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/organization"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestRefresh_AposAceiteDevolveOrg(t *testing.T) {
	database := testDB(t)
	ctx := context.Background()
	identityRepo := identity.NewRepository(database)
	orgRepo := organization.NewRepository(database)
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	jwtSvc := auth.NewJWTService(privKey, &privKey.PublicKey, 15*time.Minute)
	svc := identity.NewServiceWithOrgAndAudit(identityRepo, &identity.OrgMemberAdapter{Repo: orgRepo}, jwtSvc, &identity.NoopAuditLogger{})

	const senha = "senha-do-convidado"
	hash, err := bcrypt.GenerateFromPassword([]byte(senha), bcrypt.MinCost)
	require.NoError(t, err)

	owner, err := identityRepo.CreateUser(ctx, "owner-refresh@test.com", string(hash))
	require.NoError(t, err)
	org, err := orgRepo.CreateWithOwner(ctx, "Admin Refresh", owner.ID)
	require.NoError(t, err)

	orgSvc := organization.NewService(orgRepo, noopInviteNotifier{}, "http://app.test")
	created, err := orgSvc.CreateInvite(auth.WithOwnerIDOrgID(ctx, owner.ID, org.ID), organization.CreateInviteInput{
		Email: "guest-refresh@test.com",
		Role:  organization.RoleManager,
	})
	require.NoError(t, err)

	guest, err := identityRepo.CreateUser(ctx, "guest-refresh@test.com", string(hash))
	require.NoError(t, err)

	antes, err := svc.Login(ctx, "guest-refresh@test.com", senha)
	require.NoError(t, err)
	require.Empty(t, antes.OrganizationID, "antes do aceite o usuário não tem org")

	require.NoError(t, orgSvc.AcceptInvite(ctx, created.Token, guest.ID))

	depois, err := svc.Refresh(ctx, antes.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, org.ID.String(), depois.OrganizationID)

	claims, err := jwtSvc.Verify(depois.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, org.ID, claims.OrganizationID)
}

// noopInviteNotifier descarta o e-mail: este teste cobre o aceite, não o envio.
type noopInviteNotifier struct{}

func (noopInviteNotifier) NotifyInvite(context.Context, uuid.UUID, string, string, string) error {
	return nil
}

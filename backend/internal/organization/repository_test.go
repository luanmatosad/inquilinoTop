package organization_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/identity"
	"github.com/inquilinotop/api/internal/organization"
	"github.com/inquilinotop/api/pkg/db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testOrgDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = "postgres://postgres:postgres@localhost:5433/inquilinotop_test?sslmode=disable"
	}
	d, err := db.New(context.Background(), url)
	require.NoError(t, err)
	require.NoError(t, db.RunMigrations(url, "../../migrations"))
	t.Cleanup(func() {
		d.Pool.Exec(context.Background(), "TRUNCATE organizations, users CASCADE")
		d.Close()
	})
	return d
}

func newTestUser(t *testing.T, d *db.DB, email string) uuid.UUID {
	t.Helper()
	user, err := identity.NewRepository(d).CreateUser(context.Background(), email, "hash123")
	require.NoError(t, err)
	return user.ID
}

// insertMember grava a membership direto: o repositório não expõe criação avulsa de membro.
func insertMember(t *testing.T, d *db.DB, orgID, userID uuid.UUID, role organization.RoleType) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := d.Pool.QueryRow(context.Background(), `
		INSERT INTO organization_members (organization_id, user_id, role)
		VALUES ($1, $2, $3)
		RETURNING id
	`, orgID, userID, role).Scan(&id)
	require.NoError(t, err)
	return id
}

func TestRepository_CreateWithOwner_MesmoUsuarioSegundaVezRetornaErro(t *testing.T) {
	d := testOrgDB(t)
	repo := organization.NewRepository(d)
	userID := newTestUser(t, d, "owner-dup@test.com")

	_, err := repo.CreateWithOwner(context.Background(), "A", userID)
	require.NoError(t, err)

	_, err = repo.CreateWithOwner(context.Background(), "B", userID)
	assert.ErrorIs(t, err, organization.ErrAlreadyHasOrganization)
}

func TestService_CreateOrganization_Concorrente_UmSoOwner(t *testing.T) {
	d := testOrgDB(t)
	svc := newTestService(organization.NewRepository(d))

	const rounds = 20
	for round := range rounds {
		userID := newTestUser(t, d, fmt.Sprintf("race-%d@test.com", round))
		ctx := setupTestContext(userID, uuid.Nil)

		start := make(chan struct{})
		var wg sync.WaitGroup
		errs := make([]error, 2)
		for i := range errs {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				_, errs[i] = svc.CreateOrganization(ctx, organization.CreateOrgInput{Name: fmt.Sprintf("Org %d", i)})
			}(i)
		}
		close(start)
		wg.Wait()

		okCount := 0
		for _, err := range errs {
			if err == nil {
				okCount++
				continue
			}
			assert.ErrorIs(t, err, organization.ErrAlreadyHasOrganization)
		}
		require.Equal(t, 1, okCount, "rodada %d: exatamente uma criação deve vencer", round)

		var owners int
		require.NoError(t, d.Pool.QueryRow(context.Background(),
			`SELECT COUNT(*) FROM organization_members WHERE user_id = $1 AND role = 'owner'`, userID,
		).Scan(&owners))
		require.Equal(t, 1, owners, "rodada %d: usuário deve ter exatamente um owner", round)
	}
}

// convitePendente cria uma org com owner e um convite viewer pendente para guestEmail.
func convitePendente(t *testing.T, d *db.DB, guestEmail string) (*organization.Service, string) {
	t.Helper()
	ctx := context.Background()
	ownerID := newTestUser(t, d, "owner-"+guestEmail)
	repo := organization.NewRepository(d)
	org, err := repo.CreateWithOwner(ctx, "Admin "+guestEmail, ownerID)
	require.NoError(t, err)
	svc := newTestService(repo)
	created, err := svc.CreateInvite(setupTestContext(ownerID, org.ID), organization.CreateInviteInput{Email: guestEmail, Role: organization.RoleViewer})
	require.NoError(t, err)
	return svc, created.Token
}

func TestRepository_AcceptInvite_ConcorrentesCriamUmaMembership(t *testing.T) {
	d := testOrgDB(t)
	const guest = "convidado-race@test.com"
	svc, token := convitePendente(t, d, guest)
	guestID := newTestUser(t, d, guest)
	ctx := context.Background()

	const tentativas = 2
	errs := make([]error, tentativas)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range tentativas {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			errs[i] = svc.AcceptInvite(ctx, token, guestID)
		}()
	}
	close(start)
	wg.Wait()

	var aceitos, jaUsados int
	for _, err := range errs {
		switch {
		case err == nil:
			aceitos++
		case errors.Is(err, organization.ErrInviteAlreadyUsed):
			jaUsados++
		}
	}
	assert.Equal(t, 1, aceitos)
	assert.Equal(t, 1, jaUsados)

	var membros int
	require.NoError(t, d.Pool.QueryRow(ctx, `SELECT count(*) FROM organization_members WHERE user_id = $1`, guestID).Scan(&membros))
	assert.Equal(t, 1, membros)
}

func TestRepository_AcceptInvite_UsuarioComOutraOrgNaoAceitaEConviteFicaPendente(t *testing.T) {
	d := testOrgDB(t)
	const guest = "convidado-outra@test.com"
	svc, token := convitePendente(t, d, guest)
	guestID := newTestUser(t, d, guest)
	ctx := context.Background()
	_, err := organization.NewRepository(d).CreateWithOwner(ctx, "Outra", guestID)
	require.NoError(t, err)

	err = svc.AcceptInvite(ctx, token, guestID)
	assert.ErrorIs(t, err, organization.ErrAlreadyHasOrganization)

	inv, err := svc.GetInviteByToken(ctx, token)
	require.NoError(t, err)
	assert.Nil(t, inv.AcceptedAt)
}

func TestRepository_GetUserEmail(t *testing.T) {
	d := testOrgDB(t)
	repo := organization.NewRepository(d)
	userID := newTestUser(t, d, "email-lookup@test.com")

	email, err := repo.GetUserEmail(context.Background(), userID)
	require.NoError(t, err)
	assert.Equal(t, "email-lookup@test.com", email)

	_, err = repo.GetUserEmail(context.Background(), uuid.New())
	assert.Error(t, err)
}

func TestRepository_UpdateOrganization(t *testing.T) {
	ctx := context.Background()
	d := testOrgDB(t)
	repo := organization.NewRepository(d)
	org, err := repo.CreateWithOwner(ctx, "Antigo", newTestUser(t, d, "org-update@test.com"))
	require.NoError(t, err)

	up, err := repo.Update(ctx, org.ID, organization.UpdateOrgInput{Name: "Novo"})
	require.NoError(t, err)
	assert.Equal(t, "Novo", up.Name)

	lida, err := repo.GetByID(ctx, org.ID)
	require.NoError(t, err)
	assert.Equal(t, "Novo", lida.Name)
}

func TestRepository_Branches_CRUDRespeitaOrganizacao(t *testing.T) {
	ctx := context.Background()
	d := testOrgDB(t)
	repo := organization.NewRepository(d)
	orgA, err := repo.CreateWithOwner(ctx, "Org A", newTestUser(t, d, "branch-a@test.com"))
	require.NoError(t, err)
	orgB, err := repo.CreateWithOwner(ctx, "Org B", newTestUser(t, d, "branch-b@test.com"))
	require.NoError(t, err)

	region := "Centro"
	b, err := repo.CreateBranch(ctx, orgA.ID, organization.CreateBranchInput{Name: "Filial 1", Region: &region})
	require.NoError(t, err)

	got, err := repo.GetBranch(ctx, b.ID, orgA.ID)
	require.NoError(t, err)
	require.NotNil(t, got)
	assert.Equal(t, "Filial 1", got.Name)

	naoVisivel, err := repo.GetBranch(ctx, b.ID, orgB.ID)
	require.NoError(t, err)
	assert.Nil(t, naoVisivel, "filial de outra organização não é visível")

	listaB, err := repo.ListBranches(ctx, orgB.ID)
	require.NoError(t, err)
	assert.Empty(t, listaB)

	inativa := false
	up, err := repo.UpdateBranch(ctx, b.ID, orgA.ID, organization.UpdateBranchInput{Name: "Filial Norte", IsActive: &inativa})
	require.NoError(t, err)
	assert.Equal(t, "Filial Norte", up.Name)
	assert.False(t, up.IsActive)

	// Tentativa de outra organização: não pode alterar a filial (erro ou nil, o estado é o que importa).
	_, _ = repo.UpdateBranch(ctx, b.ID, orgB.ID, organization.UpdateBranchInput{Name: "Invadida"})
	still, err := repo.GetBranch(ctx, b.ID, orgA.ID)
	require.NoError(t, err)
	require.NotNil(t, still)
	assert.Equal(t, "Filial Norte", still.Name)

	require.NoError(t, repo.DeleteBranch(ctx, b.ID, orgB.ID))
	stillThere, err := repo.GetBranch(ctx, b.ID, orgA.ID)
	require.NoError(t, err)
	assert.NotNil(t, stillThere, "delete por outra organização não remove a filial")

	require.NoError(t, repo.DeleteBranch(ctx, b.ID, orgA.ID))
	gone, err := repo.GetBranch(ctx, b.ID, orgA.ID)
	require.NoError(t, err)
	assert.Nil(t, gone)
}

func TestRepository_Members_CRUDRespeitaOrganizacao(t *testing.T) {
	ctx := context.Background()
	d := testOrgDB(t)
	repo := organization.NewRepository(d)
	orgA, err := repo.CreateWithOwner(ctx, "Org A", newTestUser(t, d, "member-owner@test.com"))
	require.NoError(t, err)
	orgB, err := repo.CreateWithOwner(ctx, "Org B", newTestUser(t, d, "member-outro@test.com"))
	require.NoError(t, err)

	memberID := insertMember(t, d, orgA.ID, newTestUser(t, d, "member-guest@test.com"), organization.RoleViewer)

	listaA, err := repo.ListMembers(ctx, orgA.ID)
	require.NoError(t, err)
	assert.Len(t, listaA, 2)

	listaB, err := repo.ListMembers(ctx, orgB.ID)
	require.NoError(t, err)
	assert.Len(t, listaB, 1, "org B só tem o próprio owner")

	require.NoError(t, repo.UpdateMemberRole(ctx, memberID, organization.RoleManager))
	atual, err := repo.GetMembershipByID(ctx, memberID)
	require.NoError(t, err)
	require.NotNil(t, atual)
	assert.Equal(t, organization.RoleManager, atual.Role)

	require.NoError(t, repo.RemoveMember(ctx, memberID, orgB.ID))
	listaAposRemocaoErrada, err := repo.ListMembers(ctx, orgA.ID)
	require.NoError(t, err)
	assert.Len(t, listaAposRemocaoErrada, 2, "remoção por outra organização não afeta a membership")

	require.NoError(t, repo.RemoveMember(ctx, memberID, orgA.ID))
	listaFinal, err := repo.ListMembers(ctx, orgA.ID)
	require.NoError(t, err)
	assert.Len(t, listaFinal, 1)
}

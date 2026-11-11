package organization_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/inquilinotop/api/internal/organization"
	"github.com/inquilinotop/api/pkg/auth"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRepo struct {
	orgs            map[uuid.UUID]*organization.Organization
	members         map[uuid.UUID]*organization.Member
	invites         map[uuid.UUID]*organization.Invite
	branches        map[uuid.UUID]*organization.Branch
	tokenHashes     map[string]uuid.UUID // SHA-256 do token -> id do convite
	emails          map[uuid.UUID]string // userID -> e-mail
	acceptErr       error                // erro forçado no aceite (falha de banco)
	createInviteErr error                // erro forçado na gravação do convite
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		orgs:        make(map[uuid.UUID]*organization.Organization),
		members:     make(map[uuid.UUID]*organization.Member),
		invites:     make(map[uuid.UUID]*organization.Invite),
		branches:    make(map[uuid.UUID]*organization.Branch),
		tokenHashes: make(map[string]uuid.UUID),
		emails:      make(map[uuid.UUID]string),
	}
}

func (m *mockRepo) GetByID(ctx context.Context, id uuid.UUID) (*organization.Organization, error) {
	if org, ok := m.orgs[id]; ok {
		return org, nil
	}
	return nil, nil
}

func (m *mockRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*organization.Organization, error) {
	for _, member := range m.members {
		if member.UserID == userID {
			return m.orgs[member.OrganizationID], nil
		}
	}
	return nil, nil
}

func (m *mockRepo) Update(ctx context.Context, id uuid.UUID, in organization.UpdateOrgInput) (*organization.Organization, error) {
	if org, ok := m.orgs[id]; ok {
		org.Name = in.Name
		return org, nil
	}
	return nil, nil
}

func (m *mockRepo) CreateWithOwner(ctx context.Context, name string, ownerID uuid.UUID) (*organization.Organization, error) {
	org := &organization.Organization{ID: uuid.New(), Name: name}
	m.orgs[org.ID] = org
	m.members[uuid.New()] = &organization.Member{OrganizationID: org.ID, UserID: ownerID, Role: organization.RoleOwner}
	return org, nil
}

func (m *mockRepo) CreateBranch(ctx context.Context, orgID uuid.UUID, in organization.CreateBranchInput) (*organization.Branch, error) {
	return nil, nil
}

func (m *mockRepo) GetBranch(ctx context.Context, id, orgID uuid.UUID) (*organization.Branch, error) {
	if branch, ok := m.branches[id]; ok && branch.OrganizationID == orgID {
		return branch, nil
	}
	return nil, nil
}

func (m *mockRepo) ListBranches(ctx context.Context, orgID uuid.UUID) ([]organization.Branch, error) {
	return nil, nil
}

func (m *mockRepo) UpdateBranch(ctx context.Context, id, orgID uuid.UUID, in organization.UpdateBranchInput) (*organization.Branch, error) {
	return nil, nil
}

func (m *mockRepo) DeleteBranch(ctx context.Context, id, orgID uuid.UUID) error {
	return nil
}

func (m *mockRepo) GetMembership(ctx context.Context, userID, orgID uuid.UUID) (*organization.Member, error) {
	for _, member := range m.members {
		if member.UserID == userID && member.OrganizationID == orgID {
			return member, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) GetMembershipByID(ctx context.Context, memberID uuid.UUID) (*organization.Member, error) {
	if member, ok := m.members[memberID]; ok {
		return member, nil
	}
	return nil, nil
}

func (m *mockRepo) ListMembers(ctx context.Context, orgID uuid.UUID) ([]organization.Member, error) {
	var list []organization.Member
	for _, member := range m.members {
		if member.OrganizationID == orgID {
			list = append(list, *member)
		}
	}
	return list, nil
}

func (m *mockRepo) UpdateMemberRole(ctx context.Context, memberID uuid.UUID, role organization.RoleType) error {
	if member, ok := m.members[memberID]; ok {
		member.Role = role
	}
	return nil
}

func (m *mockRepo) RemoveMember(ctx context.Context, memberID, orgID uuid.UUID) error {
	if member, ok := m.members[memberID]; ok && member.OrganizationID == orgID {
		delete(m.members, memberID)
	}
	return nil
}

func (m *mockRepo) HasRole(ctx context.Context, userID, orgID uuid.UUID, role organization.RoleType) (bool, error) {
	return true, nil
}

func (m *mockRepo) CreateInvite(ctx context.Context, in organization.CreateInviteInput, orgID, invitedBy uuid.UUID, tokenHash string, expiresAt time.Time) (*organization.Invite, error) {
	if m.createInviteErr != nil {
		return nil, m.createInviteErr
	}
	invite := &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          in.Email,
		Role:           in.Role,
		BranchID:       in.BranchID,
		InvitedBy:      invitedBy,
		ExpiresAt:      expiresAt,
		CreatedAt:      time.Now(),
	}
	m.invites[invite.ID] = invite
	m.tokenHashes[tokenHash] = invite.ID
	return invite, nil
}

func (m *mockRepo) GetInviteByToken(ctx context.Context, tokenHash string) (*organization.Invite, error) {
	if id, ok := m.tokenHashes[tokenHash]; ok {
		return m.invites[id], nil
	}
	return nil, nil
}

func (m *mockRepo) ListInvites(ctx context.Context, orgID uuid.UUID) ([]organization.Invite, error) {
	var list []organization.Invite
	for _, invite := range m.invites {
		if invite.OrganizationID == orgID {
			list = append(list, *invite)
		}
	}
	return list, nil
}

func (m *mockRepo) CancelInvite(ctx context.Context, inviteID, orgID uuid.UUID) error {
	if invite, ok := m.invites[inviteID]; ok && invite.OrganizationID == orgID {
		delete(m.invites, inviteID)
	}
	return nil
}

func (m *mockRepo) AcceptInvite(ctx context.Context, invite *organization.Invite, userID uuid.UUID) error {
	if m.acceptErr != nil {
		return m.acceptErr
	}
	for _, member := range m.members {
		if member.UserID == userID {
			return organization.ErrAlreadyHasOrganization
		}
	}
	now := time.Now()
	invite.AcceptedAt = &now
	return nil
}

func (m *mockRepo) GetUserEmail(ctx context.Context, userID uuid.UUID) (string, error) {
	return m.emails[userID], nil
}

func (m *mockRepo) GetInviteByEmail(ctx context.Context, email string, orgID uuid.UUID) (*organization.Invite, error) {
	return nil, nil
}

func (m *mockRepo) GetMembershipByUserID(ctx context.Context, userID uuid.UUID) (*organization.Member, error) {
	for _, member := range m.members {
		if member.UserID == userID {
			return member, nil
		}
	}
	return nil, nil
}

func setupTestContext(userID, orgID uuid.UUID) context.Context {
	return auth.WithOwnerIDOrgID(context.Background(), userID, orgID)
}

func TestService_GetOrganization(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	
	repo.orgs[orgID] = &organization.Organization{
		ID:   orgID,
		Name: "Test Org",
	}

	ctx := setupTestContext(userID, orgID)
	
	org, err := svc.GetOrganization(ctx)
	require.NoError(t, err)
	require.NotNil(t, org)
	assert.Equal(t, "Test Org", org.Name)
}

func TestService_UpdateOrganization(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	
	repo.orgs[orgID] = &organization.Organization{
		ID:   orgID,
		Name: "Test Org",
	}

	ctx := setupTestContext(userID, orgID)
	
	org, err := svc.UpdateOrganization(ctx, organization.UpdateOrgInput{Name: "Updated Org"})
	require.NoError(t, err)
	require.NotNil(t, org)
	assert.Equal(t, "Updated Org", org.Name)
}

func TestService_CreateOrganization_CriaOrgComOwner(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	ctx := setupTestContext(uuid.New(), uuid.Nil)

	org, err := svc.CreateOrganization(ctx, organization.CreateOrgInput{Name: "Administradora X"})
	require.NoError(t, err)
	require.NotNil(t, org)

	mine, err := svc.GetMyOrganization(ctx)
	require.NoError(t, err)
	require.NotNil(t, mine)
	assert.Equal(t, org.ID, mine.ID)
}

func TestService_CreateOrganization_UsuarioComOrgRecusa(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	ctx := setupTestContext(uuid.New(), uuid.Nil)

	_, err := svc.CreateOrganization(ctx, organization.CreateOrgInput{Name: "A"})
	require.NoError(t, err)

	_, err = svc.CreateOrganization(ctx, organization.CreateOrgInput{Name: "B"})
	assert.ErrorIs(t, err, organization.ErrAlreadyHasOrganization)
}

func TestService_ListMembers(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()

	repo.members[uuid.New()] = &organization.Member{
		ID:             uuid.New(),
		OrganizationID: orgID,
		UserID:         userID,
		Role:           organization.RoleOwner,
	}

	repo.members[uuid.New()] = &organization.Member{
		ID:             uuid.New(),
		OrganizationID: orgID,
		UserID:         uuid.New(),
		Role:           organization.RoleAdmin,
	}

	ctx := setupTestContext(userID, orgID)
	
	members, err := svc.ListMembers(ctx)
	require.NoError(t, err)
	assert.Len(t, members, 2)
}

func TestService_UpdateMemberRole_CannotChangeOwner(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	memberID := uuid.New()

	repo.members[memberID] = &organization.Member{
		ID:             memberID,
		OrganizationID: orgID,
		UserID:         uuid.New(),
		Role:           organization.RoleOwner,
	}

	ctx := setupTestContext(userID, orgID)
	
	_, err := svc.UpdateMemberRole(ctx, memberID, organization.UpdateMemberRoleInput{Role: organization.RoleAdmin})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot change owner role")
}

func TestService_RemoveMember_CannotRemoveOwner(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	memberID := uuid.New()

	repo.members[memberID] = &organization.Member{
		ID:             memberID,
		OrganizationID: orgID,
		UserID:         uuid.New(),
		Role:           organization.RoleOwner,
	}

	ctx := setupTestContext(userID, orgID)
	
	err := svc.RemoveMember(ctx, memberID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot remove owner")
}

func TestService_RemoveMember_CannotRemoveSelf(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	memberID := uuid.New()

	repo.members[memberID] = &organization.Member{
		ID:             memberID,
		OrganizationID: orgID,
		UserID:         userID,
		Role:           organization.RoleAdmin,
	}

	ctx := setupTestContext(userID, orgID)
	
	err := svc.RemoveMember(ctx, memberID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cannot remove yourself")
}

func hashOf(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func seedInvite(repo *mockRepo, orgID uuid.UUID, email, token string, expiresAt time.Time) *organization.Invite {
	invite := &organization.Invite{ID: uuid.New(), OrganizationID: orgID, Email: email, Role: organization.RoleEmployee, ExpiresAt: expiresAt}
	repo.invites[invite.ID] = invite
	repo.tokenHashes[hashOf(token)] = invite.ID
	return invite
}

// newTestService monta o serviço com notificador que aceita tudo; testes de e-mail montam o seu.
func newTestService(repo organization.Repository) *organization.Service {
	return organization.NewService(repo, &fakeNotifier{}, "http://app.test")
}

func seedOrg(repo *mockRepo, name string) uuid.UUID {
	id := uuid.New()
	repo.orgs[id] = &organization.Organization{ID: id, Name: name}
	return id
}

type inviteMail struct {
	invitedBy uuid.UUID
	toEmail   string
	orgName   string
	acceptURL string
}

// fakeNotifier grava os convites enfileirados; err simula falha ao enfileirar.
type fakeNotifier struct {
	mails []inviteMail
	err   error
}

func (f *fakeNotifier) NotifyInvite(_ context.Context, invitedBy uuid.UUID, toEmail, orgName, acceptURL string) error {
	f.mails = append(f.mails, inviteMail{invitedBy: invitedBy, toEmail: toEmail, orgName: orgName, acceptURL: acceptURL})
	return f.err
}

func TestService_CreateInvite_GuardaSoHash(t *testing.T) {
	repo := newMockRepo()
	orgID := seedOrg(repo, "Imobiliária Teste")
	svc := newTestService(repo)

	created, err := svc.CreateInvite(setupTestContext(uuid.New(), orgID), organization.CreateInviteInput{
		Email: "test@example.com",
		Role:  organization.RoleAdmin,
	})
	require.NoError(t, err)
	require.NotEmpty(t, created.Token)
	assert.Equal(t, "test@example.com", created.Email)

	_, rawStored := repo.tokenHashes[created.Token]
	assert.False(t, rawStored, "token bruto não pode chegar ao repositório")
	_, hashStored := repo.tokenHashes[hashOf(created.Token)]
	assert.True(t, hashStored, "repositório guarda o SHA-256 do token")
}

func TestService_CreateInvite_EnfileiraEmailComTokenNoLink(t *testing.T) {
	repo := newMockRepo()
	orgID := seedOrg(repo, "Imobiliária Teste")
	notifier := &fakeNotifier{}
	svc := organization.NewService(repo, notifier, "https://app.test")
	ownerID := uuid.New()

	created, err := svc.CreateInvite(setupTestContext(ownerID, orgID), organization.CreateInviteInput{
		Email: "convidado@example.com",
		Role:  organization.RoleManager,
	})
	require.NoError(t, err)

	require.Len(t, notifier.mails, 1)
	mail := notifier.mails[0]
	assert.Equal(t, ownerID, mail.invitedBy)
	assert.Equal(t, "convidado@example.com", mail.toEmail)
	assert.Equal(t, "Imobiliária Teste", mail.orgName)
	assert.Equal(t, "https://app.test/invite/accept?token="+created.Token, mail.acceptURL)
}

func TestService_CreateInvite_FalhaAoEnfileirarNaoDesfazConvite(t *testing.T) {
	repo := newMockRepo()
	orgID := seedOrg(repo, "Imobiliária Teste")
	svc := organization.NewService(repo, &fakeNotifier{err: errors.New("fila indisponível")}, "https://app.test")

	created, err := svc.CreateInvite(setupTestContext(uuid.New(), orgID), organization.CreateInviteInput{
		Email: "convidado@example.com",
		Role:  organization.RoleViewer,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, created.Token)
	_, stored := repo.tokenHashes[hashOf(created.Token)]
	assert.True(t, stored, "convite gravado continua válido mesmo sem e-mail")
}

func TestService_CreateInvite_FalhaNaGravacaoNaoEnfileira(t *testing.T) {
	repo := newMockRepo()
	repo.createInviteErr = errors.New("banco indisponível")
	orgID := seedOrg(repo, "Imobiliária Teste")
	notifier := &fakeNotifier{}
	svc := organization.NewService(repo, notifier, "https://app.test")

	_, err := svc.CreateInvite(setupTestContext(uuid.New(), orgID), organization.CreateInviteInput{
		Email: "convidado@example.com",
		Role:  organization.RoleViewer,
	})
	require.Error(t, err)
	assert.Empty(t, notifier.mails)
}

func TestService_AcceptInvite_Aceita(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)
	userID := uuid.New()
	repo.emails[userID] = "convidado@example.com"
	invite := seedInvite(repo, uuid.New(), "convidado@example.com", "tok", time.Now().Add(time.Hour))

	require.NoError(t, svc.AcceptInvite(context.Background(), "tok", userID))
	assert.NotNil(t, invite.AcceptedAt)
}

func TestService_AcceptInvite_EmailEhComparadoSemCaixa(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)
	userID := uuid.New()
	repo.emails[userID] = "convidado@example.com"
	invite := seedInvite(repo, uuid.New(), "Convidado@Example.com", "tok", time.Now().Add(time.Hour))

	require.NoError(t, svc.AcceptInvite(context.Background(), "tok", userID))
	assert.NotNil(t, invite.AcceptedAt)
}

func TestService_AcceptInvite_EmailDiferenteNaoRevelaConvite(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)
	userID := uuid.New()
	repo.emails[userID] = "outro@example.com"
	invite := seedInvite(repo, uuid.New(), "convidado@example.com", "tok", time.Now().Add(time.Hour))

	err := svc.AcceptInvite(context.Background(), "tok", userID)
	assert.ErrorIs(t, err, organization.ErrInviteNotFound)
	assert.Nil(t, invite.AcceptedAt)
}

func TestService_AcceptInvite_JaUsado(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)
	userID := uuid.New()
	repo.emails[userID] = "convidado@example.com"
	invite := seedInvite(repo, uuid.New(), "convidado@example.com", "tok", time.Now().Add(time.Hour))
	used := time.Now()
	invite.AcceptedAt = &used

	err := svc.AcceptInvite(context.Background(), "tok", userID)
	assert.ErrorIs(t, err, organization.ErrInviteAlreadyUsed)
}

func TestService_AcceptInvite_Expirado(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)
	userID := uuid.New()
	repo.emails[userID] = "convidado@example.com"
	seedInvite(repo, uuid.New(), "convidado@example.com", "tok", time.Now().Add(-time.Hour))

	err := svc.AcceptInvite(context.Background(), "tok", userID)
	assert.ErrorIs(t, err, organization.ErrInviteExpired)
}

func TestService_AcceptInvite_FilialRemovida(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)
	userID := uuid.New()
	repo.emails[userID] = "convidado@example.com"
	branchID := uuid.New()
	invite := seedInvite(repo, uuid.New(), "convidado@example.com", "tok", time.Now().Add(time.Hour))
	invite.BranchID = &branchID

	err := svc.AcceptInvite(context.Background(), "tok", userID)
	assert.ErrorIs(t, err, organization.ErrInviteBranchGone)
	assert.Nil(t, invite.AcceptedAt)
}

func TestService_ListInvites(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()

	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test1@example.com",
	}

	repo.invites[uuid.New()] = &organization.Invite{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Email:          "test2@example.com",
	}

	ctx := setupTestContext(userID, orgID)
	
	invites, err := svc.ListInvites(ctx)
	require.NoError(t, err)
	assert.Len(t, invites, 2)
}

func TestService_CancelInvite(t *testing.T) {
	repo := newMockRepo()
	svc := newTestService(repo)

	userID := uuid.New()
	orgID := uuid.New()
	inviteID := uuid.New()

	repo.invites[inviteID] = &organization.Invite{
		ID:             inviteID,
		OrganizationID: orgID,
		Email:          "test@example.com",
	}

	ctx := setupTestContext(userID, orgID)
	
	err := svc.CancelInvite(ctx, inviteID)
	require.NoError(t, err)
	
	_, ok := repo.invites[inviteID]
	assert.False(t, ok)
}
